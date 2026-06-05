import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Dashboard home page', () => {
  it('renders without crashing and shows welcome text', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { name: /to get started/i });
    expect(heading).toBeInTheDocument();
  });
});
