import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeIntro } from '../WelcomeIntro';

describe('WelcomeIntro', () => {
  beforeEach(() => localStorage.clear());

  it('explains what Helm is and that it is a real, installable app', () => {
    render(<WelcomeIntro />);
    expect(screen.getByRole('heading', { name: /consulting back office/i })).toBeInTheDocument();
    expect(screen.getByText(/local-first PSA/i)).toBeInTheDocument();
    expect(screen.getByText(/not a demo/i)).toBeInTheDocument();
    expect(screen.getByText(/Installable app/i)).toBeInTheDocument();
    expect(screen.getByText(/data stays on your device/i)).toBeInTheDocument();
  });

  it('hides after it is dismissed', async () => {
    render(<WelcomeIntro />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(
      screen.queryByRole('heading', { name: /consulting back office/i }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem('helm-intro-dismissed')).toBe('1');
  });
});
