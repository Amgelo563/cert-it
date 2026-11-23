// the form works without JavaScript
import '@fontsource-variable/inter/wght.css';
import 'virtual:theme.css';
import '../style/public.css';
import { DetailsMenu } from '../menu/DetailsMenu';

DetailsMenu.startAll();

document.getElementById('lookup-message')?.focus();
