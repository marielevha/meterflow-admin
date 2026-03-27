type E2CBrandMarkProps = {
  size?: number;
  className?: string;
};

type E2CAdminBrandProps = {
  className?: string;
  frameClassName?: string;
  markClassName?: string;
  markSize?: number;
  showText?: boolean;
  title?: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

const brandThemeClasses =
  "[--brand-surface:#e9efff] [--brand-primary:#0f172a] [--brand-shadow:#b9cdfc] [--brand-shadow-alt:#d8e3ff] [--brand-accent:#8aa6ff] dark:[--brand-surface:rgba(255,255,255,0.08)] dark:[--brand-primary:#f8fafc] dark:[--brand-shadow:rgba(138,166,255,0.45)] dark:[--brand-shadow-alt:rgba(216,227,255,0.22)] dark:[--brand-accent:#9ab2ff]";

export function E2CBrandMark({
  size = 28,
  className = "",
}: E2CBrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 112 112"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="10"
        y="74"
        fill="var(--brand-shadow-alt)"
        opacity="0.95"
        fontSize="42"
        fontWeight="800"
        fontFamily="Arial, Helvetica, sans-serif"
        textLength="80"
        lengthAdjust="spacingAndGlyphs"
      >
        E2C
      </text>
      <text
        x="16"
        y="69"
        fill="var(--brand-primary)"
        fontSize="42"
        fontWeight="800"
        fontFamily="Arial, Helvetica, sans-serif"
        textLength="80"
        lengthAdjust="spacingAndGlyphs"
      >
        E2C
      </text>
      <circle cx="89" cy="23" r="5" fill="var(--brand-accent)" opacity="0.9" />
    </svg>
  );
}

export function E2CAdminBrand({
  className = "",
  frameClassName = "",
  markClassName = "",
  markSize = 28,
  showText = true,
  title = "E2C Admin",
  subtitle,
  titleClassName = "",
  subtitleClassName = "",
}: E2CAdminBrandProps) {
  return (
    <span
      className={`inline-flex items-center gap-3 text-gray-900 dark:text-white ${brandThemeClasses} ${className}`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-[var(--brand-surface)] shadow-[0_18px_36px_-24px_rgba(21,62,175,0.7)] dark:border-white/10 dark:shadow-none ${frameClassName}`}
      >
        <E2CBrandMark size={markSize} className={markClassName} />
      </span>
      {showText ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={`truncate text-sm font-semibold tracking-[0.18em] text-gray-900 dark:text-white ${titleClassName}`}
          >
            {title}
          </span>
          {subtitle ? (
            <span
              className={`mt-1 truncate text-[11px] font-medium uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400 ${subtitleClassName}`}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
