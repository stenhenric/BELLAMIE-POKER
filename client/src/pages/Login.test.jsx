import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as AuthContext from '../context/AuthContext';
import userEvent from '@testing-library/user-event';

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  it('displays an error message when login fails with a response data message', async () => {
    // Setup mock for useAuth
    const mockLogin = vi.fn().mockRejectedValue({
      response: {
        data: {
          message: 'Invalid credentials provided',
        },
      },
    });

    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ login: mockLogin });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Type in email and password
    const emailInput = screen.getByPlaceholderText(/EMAIL ADDRESS/i);
    const passwordInput = screen.getByPlaceholderText(/PASSWORD/i);
    const submitButton = screen.getByRole('button', { name: /Enter Lounge/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');

    // Submit form
    await userEvent.click(submitButton);

    // Assert login was called
    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'wrongpassword');

    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials provided')).toBeInTheDocument();
    });
  });

  it('displays a fallback error message when login fails without a specific message', async () => {
    // Setup mock for useAuth with a generic error
    const mockLogin = vi.fn().mockRejectedValue(new Error('Network Error'));

    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ login: mockLogin });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Type in email and password
    const emailInput = screen.getByPlaceholderText(/EMAIL ADDRESS/i);
    const passwordInput = screen.getByPlaceholderText(/PASSWORD/i);
    const submitButton = screen.getByRole('button', { name: /Enter Lounge/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');

    // Submit form
    await userEvent.click(submitButton);

    // Wait for the default error message to appear
    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });
});
