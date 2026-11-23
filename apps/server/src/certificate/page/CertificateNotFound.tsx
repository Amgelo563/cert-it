type CertificateNotFoundProps = {
  title: string;
  help: string;
};

/** The main content shown for a code that matches no certificate. */
export function CertificateNotFound(props: CertificateNotFoundProps) {
  return (
    <main class="container message">
      <h1>{props.title}</h1>
      <p>{props.help}</p>
    </main>
  );
}
