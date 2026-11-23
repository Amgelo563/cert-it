type LookupIllustrationProps = {
  /** Text of the status badge over the drawing, as on a certificate's page. */
  badge: string;
};

/** A drawn certificate with a valid badge, beside the lookup form. Colored from the theme, so it follows light and dark. */
export function LookupIllustration(props: LookupIllustrationProps) {
  return (
    <div class="lookup-art" aria-hidden="true">
      <svg class="lookup-art-drawing" viewBox="0 0 400 300">
        <rect
          class="art-sheet-back"
          x="40"
          y="34"
          width="320"
          height="226"
          rx="10"
          transform="rotate(-7 200 147)"
        />
        <rect
          class="art-sheet"
          x="40"
          y="34"
          width="320"
          height="226"
          rx="10"
        />
        <rect class="art-frame" x="54" y="48" width="292" height="198" rx="6" />

        {/* heading, holder name and course */}
        <rect class="art-line" x="165" y="70" width="70" height="6" rx="3" />
        <rect
          class="art-accent"
          x="120"
          y="86"
          width="160"
          height="12"
          rx="6"
        />
        <rect
          class="art-line-strong"
          x="100"
          y="120"
          width="200"
          height="16"
          rx="8"
        />
        <rect class="art-line" x="110" y="150" width="180" height="6" rx="3" />
        <rect class="art-line" x="135" y="164" width="130" height="6" rx="3" />

        {/* signature */}
        <path
          class="art-ink"
          d="M82 206c8-14 14-16 16-8s-4 12 4 4 12-14 14-6-2 10 8 2 14-6 22-4"
        />
        <rect class="art-line" x="78" y="216" width="96" height="2" rx="1" />

        {/* seal with its ribbon */}
        <path class="art-ribbon" d="M287 222l-8 34 11-6 9 9 3-33z" />
        <path class="art-ribbon" d="M313 222l8 34-11-6-9 9-3-33z" />
        <circle class="art-seal" cx="300" cy="206" r="26" />
        <circle class="art-seal-ring" cx="300" cy="206" r="19" />
        <path class="art-seal-mark" d="m290 207 7 7 13-14" />
      </svg>

      <p class="status status-valid lookup-art-badge">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
        {props.badge}
      </p>
    </div>
  );
}
