import {
  getOnboardingSteps,
  type Locale,
  type OnboardingState,
  type OnboardingStep,
  OnboardingStepEnum,
} from '@cert-it/shared';
import { notifications } from '@mantine/notifications';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { ApiClient } from '../app/api/ApiClient';
import { ApiClientContext } from '../app/api/ApiClientContext';
import { describeApiError } from '../app/api/describeApiError';
import { useApiClient } from '../app/api/useApiClient';
import { enumMessageKeys } from '../app/i18n/enumMessageKeys';
import { AdminPathEnum } from '../app/router/AdminPathEnum';
import { certificatePageUrl } from '../course/participants/certificatePageUrl';
import { useAuth } from '../auth/useAuth';
import { SampleCertificateModal } from './certificate/SampleCertificateModal';
import { OnboardingHub } from './hub/OnboardingHub';
import {
  OnboardingContext,
  type OnboardingContextValue,
} from './OnboardingContext';
import { PracticeBackend } from './practice/PracticeBackend';
import { createTour } from './tour/createTour';
import { TourCard } from './tour/TourCard';
import { TourRunner, type TourView } from './tour/TourRunner';

type OnboardingProviderProps = {
  children: ReactNode;
};

type ActiveTour = { step: OnboardingStep; runner: TourRunner };

// once per browser session, so a reload doesn't open it again
const AutoOpenedKey = 'cert-it:onboarding-opened';

// Mantine's sm breakpoint, below which the designer doesn't fit
const NarrowQuery = '(max-width: 48em)';

const StepKeys = enumMessageKeys(OnboardingStepEnum);

/** Loads the user's progress through the getting started guide, opens it on first visits, and runs its tours on practice data. */
export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const path = useRef(location.pathname);
  useEffect(() => {
    path.current = location.pathname;
  }, [location.pathname]);

  const [state, setState] = useState<OnboardingState | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [starting, setStarting] = useState<OnboardingStep | null>(null);
  const [backend, setBackend] = useState<PracticeBackend | null>(null);
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const [view, setView] = useState<TourView | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const role = user?.role ?? null;
  const steps = useMemo(() => (role ? getOnboardingSteps(role) : []), [role]);

  const practiceApi = useMemo(
    () => backend && ApiClient.create({ injections: { fetch: backend.fetch } }),
    [backend],
  );

  useEffect(() => {
    let current = true;
    api
      .request((routes) => routes.onboarding.$get())
      .then(
        (loaded) => {
          if (!current) return;
          setState(loaded);
          const pending = loaded.completedSteps.length < steps.length;
          if (
            !loaded.dismissed
            && pending
            && !sessionStorage.getItem(AutoOpenedKey)
          ) {
            sessionStorage.setItem(AutoOpenedKey, '1');
            setHubOpen(true);
          }
        },
        // the panel works without the guide
        () => {},
      );
    return () => {
      current = false;
    };
  }, [api, steps.length]);

  // a tour still running when the panel goes away stops with it
  const running = useRef<TourRunner | null>(null);
  useEffect(() => {
    running.current = tour?.runner ?? null;
  }, [tour]);
  useEffect(() => () => running.current?.stop(), []);

  const closeTour = useCallback(() => {
    running.current?.stop();
    setTour(null);
    setView(null);
    setSampleOpen(false);
  }, []);

  const complete = useCallback(
    (step: OnboardingStep) => {
      closeTour();
      setHubOpen(true);
      api
        .request((routes) =>
          routes.onboarding.steps[':step'].$put({ param: { step } }),
        )
        .then(setState, (error: unknown) =>
          notifications.show({
            color: 'red',
            message: describeApiError(error, i18n),
          }),
        );
    },
    [api, closeTour, i18n],
  );

  const startPractice = useCallback(async (): Promise<PracticeBackend> => {
    if (backend) return backend;
    if (!user) throw new Error('Practice needs a logged-in user');
    const created = PracticeBackend.create({
      locale: i18n.language as Locale,
      currentUser: user,
      texts: {
        courseName: t('onboarding.samples.courseName'),
        draftCourseName: t('onboarding.samples.draftCourseName'),
        participantNames: [
          t('onboarding.samples.participant1'),
          t('onboarding.samples.participant2'),
          t('onboarding.samples.participant3'),
        ],
        teammateEmail: t('onboarding.samples.teammateEmail'),
        teammateName: t('onboarding.samples.teammateName'),
        pdf: {
          title: t('onboarding.samples.pdfTitle'),
          intro: t('onboarding.samples.pdfIntro'),
          outro: t('onboarding.samples.pdfOutro'),
        },
        fieldNames: {
          participantName: t('template.fieldNames.participantName'),
          issueDate: t('template.fieldNames.issueDate'),
          qrcode: t('template.fieldNames.qrcode'),
        },
        fieldSamples: {
          participantName: t('template.sampleName'),
          qrcode: certificatePageUrl('ABCD-EFGH-JK'),
        },
      },
    });
    await created.start();
    setBackend(created);
    return created;
  }, [backend, user, i18n.language, t]);

  const startTour = useCallback(
    async (step: OnboardingStep) => {
      setStarting(step);
      try {
        const practice = await startPractice();
        closeTour();
        setHubOpen(false);
        const runner = new TourRunner({
          steps: createTour(step, {
            sampleCourseId: practice.getSampleCourseId(),
            draftCourseId: practice.getDraftCourseId(),
            narrow: window.matchMedia(NarrowQuery).matches,
            openSampleCertificate: () => setSampleOpen(true),
          }),
          navigate: (to) => void navigate(to),
          currentPath: () => path.current,
          subscribe: (listener) => practice.onEvent(listener),
          onView: setView,
          onFinish: () => complete(step),
        });
        setTour({ step, runner });
        runner.start();
      } catch (error) {
        notifications.show({
          color: 'red',
          message: describeApiError(error, i18n),
        });
      } finally {
        setStarting(null);
      }
    },
    [startPractice, closeTour, navigate, complete, i18n],
  );

  const exitPractice = useCallback(() => {
    closeTour();
    setBackend(null);
    void navigate(AdminPathEnum.Courses);
  }, [closeTour, navigate]);

  const dismiss = useCallback(() => {
    setHubOpen(false);
    api
      .request((routes) => routes.onboarding.dismissed.$put())
      .then(
        setState,
        // it opens again next session, which is harmless
        () => {},
      );
  }, [api]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      steps,
      practicing: backend !== null,
      openHub: () => setHubOpen(true),
      exitPractice,
    }),
    [state, steps, backend, exitPractice],
  );

  const completed = useMemo(
    () => new Set(state?.completedSteps ?? []),
    [state],
  );

  return (
    <OnboardingContext value={value}>
      <ApiClientContext value={practiceApi ?? api}>
        {children}
        <OnboardingHub
          opened={hubOpen}
          onClose={() => setHubOpen(false)}
          steps={steps}
          completed={completed}
          dismissed={state?.dismissed ?? false}
          starting={starting}
          onStart={(step) => void startTour(step)}
          onDismiss={dismiss}
        />
        <SampleCertificateModal
          opened={sampleOpen}
          onClose={() => {
            setSampleOpen(false);
            // closing it is the end of the tour that opened it
            if (tour?.step === OnboardingStepEnum.ViewCertificate) {
              tour.runner.next();
            }
          }}
          api={api}
        />
        {tour
          && view
          && createPortal(
            <TourCard
              tour={StepKeys[tour.step]}
              view={view}
              onNext={() => tour.runner.next()}
              onBack={() => tour.runner.back()}
              onClose={closeTour}
            />,
            view.container,
          )}
      </ApiClientContext>
    </OnboardingContext>
  );
}
