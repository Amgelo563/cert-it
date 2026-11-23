import type { Messages } from '../../i18n/messages/Messages';
import { LookupIllustration } from './LookupIllustration';

/** A course the visitor can pick in the lookup. */
export type LookupCourseOption = {
  id: number;
  name: string;
};

type LookupPageProps = {
  texts: Messages['lookupPage'];
  /** Path the form posts to. */
  action: string;
  courses: readonly LookupCourseOption[];
  /** What the visitor sent last, kept in the form after a miss. */
  values: { email: string; courseId: number | null };
  /** Result of the last search, already formatted. */
  message: string | null;
  /** Shown in place of the form when no course is listed, already formatted. */
  noCourses: string;
  /** Footer line on who to contact, already formatted. */
  help: string;
  /** Badge of the illustration, as on a valid certificate's page. */
  validLabel: string;
};

/** The main content of the "Find my certificate" page: a form posting an email and a course, beside a drawn certificate. */
export function LookupPage(props: LookupPageProps) {
  const { texts, courses, values, message } = props;

  return (
    <>
      <main class="lookup">
        <div class="container lookup-layout">
          <div class="lookup-main">
            <h1>{texts.title}</h1>

            {courses.length === 0 ? (
              <p class="lookup-intro">{props.noCourses}</p>
            ) : (
              <>
                <p class="lookup-intro">{texts.intro}</p>

                {message && (
                  <p
                    id="lookup-message"
                    class="lookup-message notice"
                    role="alert"
                    tabindex={-1}
                  >
                    {message}
                  </p>
                )}

                <form
                  class="lookup-form"
                  method="post"
                  action={props.action}
                  aria-describedby={message ? 'lookup-message' : undefined}
                >
                  <div class="field">
                    <label for="lookup-email">{texts.email}</label>
                    <input
                      id="lookup-email"
                      class="input"
                      type="email"
                      name="email"
                      value={values.email}
                      autocomplete="email"
                      autocapitalize="off"
                      spellcheck={false}
                      required
                    />
                  </div>

                  <div class="field">
                    <label for="lookup-course">{texts.course}</label>
                    <select
                      id="lookup-course"
                      class="input"
                      name="course"
                      required
                    >
                      <option value="" selected={values.courseId === null}>
                        {texts.chooseCourse}
                      </option>
                      {courses.map((course) => (
                        <option
                          value={String(course.id)}
                          selected={course.id === values.courseId}
                        >
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" class="button button-primary">
                    {texts.submit}
                  </button>
                </form>

                <p class="lookup-next">{texts.nextStep}</p>
              </>
            )}
          </div>

          <LookupIllustration badge={props.validLabel} />
        </div>
      </main>

      <footer class="site-footer">
        <div class="container lookup-footer">{props.help}</div>
      </footer>
    </>
  );
}
