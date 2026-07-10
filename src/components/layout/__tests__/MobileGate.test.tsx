import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileGate } from '../MobileGate';

describe('MobileGate', () => {
  it('shows the Helm explainer and the desktop notice', () => {
    render(<MobileGate />);
    expect(screen.getByRole('heading', { name: 'Helm' })).toBeInTheDocument();
    expect(
      screen.getByText(/A local-first PSA for the solo consultant/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Built for desktop/i)).toBeInTheDocument();
  });
});
