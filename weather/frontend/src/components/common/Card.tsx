import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '../icons/UiIcons';

interface CardProps {
  title?: ReactNode;
  /** Visually hidden title still used as the section's accessible name. */
  hideTitle?: boolean;
  action?: { to: string; label: string };
  headerExtra?: ReactNode;
  className?: string;
  children: ReactNode;
  testId?: string;
}

export function Card({ title, hideTitle, action, headerExtra, className, children, testId }: CardProps) {
  const id = useId();
  return (
    <section className={['card', className].filter(Boolean).join(' ')} aria-labelledby={title ? id : undefined} data-testid={testId}>
      {title && (
        <header className={hideTitle ? 'visually-hidden' : 'card__header'}>
          <h2 id={id} className="card__title">
            {title}
          </h2>
          {headerExtra}
          {action && (
            <Link className="card__action" to={action.to}>
              {action.label}
              <ChevronRightIcon size={16} />
            </Link>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
