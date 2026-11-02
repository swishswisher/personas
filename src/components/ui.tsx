import Link from "next/link";
import type {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Folder,
  Users,
  FileText,
  Sparkles,
  GitCompare,
  Route,
  Share2,
  Settings,
  CreditCard,
  Bell,
  Lock,
  Clock,
  MessageSquare,
  Download,
  Upload,
  HelpCircle,
  Shield,
  Plus,
  Search,
  Check,
  Menu,
  X,
  LogOut,
  LayoutGrid,
  History,
  TriangleAlert,
  ExternalLink,
} from "lucide-react";
const icons = {
  arrow: ArrowRight,
  book: BookOpen,
  folder: Folder,
  people: Users,
  file: FileText,
  spark: Sparkles,
  compare: GitCompare,
  route: Route,
  share: Share2,
  settings: Settings,
  card: CreditCard,
  bell: Bell,
  lock: Lock,
  clock: Clock,
  comment: MessageSquare,
  download: Download,
  upload: Upload,
  help: HelpCircle,
  shield: Shield,
  plus: Plus,
  search: Search,
  check: Check,
  menu: Menu,
  close: X,
  logout: LogOut,
  grid: LayoutGrid,
  history: History,
  alert: TriangleAlert,
  external: ExternalLink,
};
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) {
  const C = icons[name];
  return <C className="icon" aria-hidden="true" strokeWidth={1.6} />;
}
export function Logo() {
  return (
    <Link className="logo" href="/">
      <span className="brandmark" aria-hidden="true" />
      personas<span style={{ color: "#9e7abb" }}>.</span>
    </Link>
  );
}
export function ButtonLink({
  href,
  children,
  tone = "primary",
  icon,
}: {
  href: string;
  children: ReactNode;
  tone?: string;
  icon?: IconName;
}) {
  return (
    <Link href={href} className={`btn ${tone}`}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}
export function Pill({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`pill ${tone}`}>
      <span className="dot" />
      {children}
    </span>
  );
}
export function Notice({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "red" ? "alert" : "status"}
    >
      <Icon name={tone === "red" ? "alert" : "shield"} />
      <div>{children}</div>
    </div>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={props.id || props.name}>
        {label}
        {props.required ? " *" : ""}
      </label>
      <input {...props} id={props.id || props.name} />
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Area({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id || props.name}>
        {label}
        {props.required ? " *" : ""}
      </label>
      <textarea {...props} id={props.id || props.name} />
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow mb8">
          {eyebrow || "Your audience, understood"}
        </div>
        <h1>{title}</h1>
        {description && <p className="mt16">{description}</p>}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
  icon = "folder",
}: {
  title: string;
  text: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="card empty">
      <div className="iconbox">
        <Icon name={icon} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="row">{children}</div>
    </div>
  );
}
export function Portrait({ tone = 0 }: { tone?: number }) {
  const colors = [
    ["#fce4d5", "#f6b99b", "#d7b89c", "#8d6b98"],
    ["#f4e2e9", "#dfc4d1", "#ab7551", "#77556d"],
    ["#ede5f7", "#d9cef2", "#dabca6", "#7a528a"],
  ][tone % 3];
  return (
    <div className="portrait">
      <svg
        viewBox="0 0 360 260"
        role="img"
        aria-label="Illustrative persona portrait"
      >
        <rect width="360" height="260" fill={colors[0]} />
        <circle cx="279" cy="54" r="111" fill={colors[1]} opacity=".45" />
        <path
          d="M-15 225C60 112 75 36 119 0h-134Z"
          fill={colors[1]}
          opacity=".6"
        />
        <path d="M91 260c2-61 25-94 87-97 63-3 95 35 99 97" fill={colors[3]} />
        <path d="M159 144v34c12 18 31 20 44 0v-38" fill={colors[2]} />
        <ellipse cx="181" cy="108" rx="45" ry="57" fill={colors[2]} />
        <path
          d="M137 108c-13-53 8-81 43-81 43 0 57 30 45 83l-7-35c-24 6-45-2-57-16-1 28-17 31-24 49Z"
          fill={colors[3]}
        />
        <path
          d="M169 137c9 7 17 7 25 0M162 106h5m29 0h5"
          fill="none"
          stroke={colors[3]}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <span>Loading your workspace…</span>
    </div>
  );
}
