import { errorMessage } from '../../api/client';
import { RefreshIcon, WarningIcon } from '../icons/UiIcons';

export function ErrorState({ error, onRetry, title = 'Could not load weather data', compact }: { error: unknown; onRetry?: () => void; title?: string; compact?: boolean }) {
  return (
    <div className={`card error-state${compact ? ' error-state--compact' : ''}`} role="alert">
      <WarningIcon size={compact ? 20 : 28} className="error-state__icon" />
      <div>
        <p className="error-state__title">{title}</p>
        <p className="error-state__message">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          <RefreshIcon size={16} /> Retry
        </button>
      )}
    </div>
  );
}
