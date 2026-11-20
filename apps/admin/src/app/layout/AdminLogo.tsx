import { IconCertificate } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { AdminPathEnum } from '../router/AdminPathEnum';
import classes from './AdminLogo.module.css';

type AdminLogoProps = {
  onClick?: () => void;
};

/** The brand tile and the app's name, linking to the home page. */
export function AdminLogo({ onClick }: AdminLogoProps) {
  const { t } = useTranslation();

  return (
    <NavLink to={AdminPathEnum.Home} className={classes.logo} onClick={onClick}>
      <span className={classes.logoMark}>
        <IconCertificate size={20} stroke={1.8} />
      </span>
      <span>{t('app.name')}</span>
    </NavLink>
  );
}
