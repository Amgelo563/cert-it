import { IconCertificate } from '@tabler/icons-react';
import { NavLink } from 'react-router';
import { useBranding } from '../branding/useBranding';
import { AdminPathEnum } from '../router/AdminPathEnum';
import classes from './AdminLogo.module.css';

type AdminLogoProps = {
  onClick?: () => void;
};

/** The site's logo, or the brand tile and the site's name, linking to the home page. */
export function AdminLogo({ onClick }: AdminLogoProps) {
  const { name, logo, logoDark } = useBranding();

  return (
    <NavLink to={AdminPathEnum.Home} className={classes.logo} onClick={onClick}>
      {logo ? (
        <>
          {/* Mantine's global classes hide one of them per color scheme */}
          <img
            src={logo}
            alt={name}
            className={
              logoDark
                ? `${classes.logoImage} mantine-dark-hidden`
                : classes.logoImage
            }
          />
          {logoDark && (
            <img
              src={logoDark}
              alt={name}
              className={`${classes.logoImage} mantine-light-hidden`}
            />
          )}
        </>
      ) : (
        <>
          <span className={classes.logoMark}>
            <IconCertificate size={18} stroke={1.5} />
          </span>
          <span>{name}</span>
        </>
      )}
    </NavLink>
  );
}
