import React from 'react';
import { render } from '@testing-library/react';
import Home from '../app/page';

// Mock the useRouter hook from Next.js
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
    };
  },
}));

// Mock the useDrm context hook
jest.mock('../app/context/DrmContext', () => ({
  useDrm() {
    return {
      currentProfile: null,
      isLoading: false,
    };
  },
}));

describe('Dashboard home page', () => {
  it('renders without crashing', () => {
    const { container } = render(<Home />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
