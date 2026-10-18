import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReminderChannelSelector from './ReminderChannelSelector';

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (key === 'bookingWizard.reminders.singleOptIn') return `single:${values?.channel}`;
      if (key === 'bookingWizard.reminders.channel.sms') return 'SMS';
      if (key === 'bookingWizard.reminders.channel.whatsapp') return 'WhatsApp';
      return key;
    },
  }),
}));

afterEach(cleanup);

describe('ReminderChannelSelector', () => {
  it('renders a simple opt-in when only one channel is available', () => {
    render(
      <ReminderChannelSelector
        availableChannels={['sms']}
        selectedChannels={[]}
        phoneValid={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /single:SMS/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/i })).not.toBeInTheDocument();
  });

  it('lets guests select several available channels', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ReminderChannelSelector
        availableChannels={['sms', 'whatsapp']}
        selectedChannels={[]}
        phoneValid
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /SMS/i }));
    expect(onChange).toHaveBeenLastCalledWith(['sms']);

    rerender(
      <ReminderChannelSelector
        availableChannels={['sms', 'whatsapp']}
        selectedChannels={['sms']}
        phoneValid
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /WhatsApp/i }));
    expect(onChange).toHaveBeenLastCalledWith(['sms', 'whatsapp']);
  });

  it('explains that a phone is required after opting in', () => {
    render(
      <ReminderChannelSelector
        availableChannels={['sms']}
        selectedChannels={['sms']}
        phoneValid={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('bookingWizard.reminders.phoneRequired');
  });

  it('does not render when the tenant has no reminder channel', () => {
    const { container } = render(
      <ReminderChannelSelector
        availableChannels={[]}
        selectedChannels={[]}
        phoneValid={false}
        onChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
