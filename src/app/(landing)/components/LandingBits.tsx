import Link from "next/link";
import styles from "../landing.module.css";

type ActionButtonProps = {
  href: string;
  children: React.ReactNode;
  small?: boolean;
};

export function ActionButton({ href, children, small = false }: ActionButtonProps) {
  return (
    <Link href={href} className={`${styles.actionButton} ${small ? styles.actionButtonSmall : ""}`}>
      {children}
    </Link>
  );
}

type SectionHeadingProps = {
  title: string;
  text: string;
};

export function SectionHeading({ title, text }: SectionHeadingProps) {
  return (
    <div className={styles.sectionHeading}>
      <h2>{title}</h2>
      <p>{text}</p>
      <span />
    </div>
  );
}

type StatTileProps = {
  value: string;
  label: string;
};

export function StatTile({ value, label }: StatTileProps) {
  return (
    <article className={styles.statTile}>
      <p>{value}</p>
      <span>{label}</span>
    </article>
  );
}
