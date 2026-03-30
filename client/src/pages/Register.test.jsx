import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Register from './Register';
import { AuthProvider } from '../context/AuthContext';
import * as AuthContextModule from '../context/AuthContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (mockRegister) => {
    // Spy on useAuth to return our mockRegister
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      register: mockRegister,
    });

    return render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    );
  };

  it('renders correctly', () => {
    renderComponent(vi.fn());
    expect(screen.getByPlaceholderText('PLAYER ALIAS')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('EMAIL ADDRESS')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('PASSWORD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Claim Seat/i })).toBeInTheDocument();
  });

  it('handles successful registration', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    renderComponent(mockRegister);

    fireEvent.change(screen.getByPlaceholderText('PLAYER ALIAS'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('EMAIL ADDRESS'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('PASSWORD'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Claim Seat/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('testuser', 'test@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
    });
  });

  it('displays specific error message from server', async () => {
    const serverError = {
      response: {
        data: {
          message: 'Username already exists',
        },
      },
    };
    const mockRegister = vi.fn().mockRejectedValue(serverError);
    renderComponent(mockRegister);

    fireEvent.change(screen.getByPlaceholderText('PLAYER ALIAS'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('EMAIL ADDRESS'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('PASSWORD'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Claim Seat/i }));

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });

    // Check if the button goes back to active state after loading
    expect(screen.getByRole('button', { name: /Claim Seat/i })).toBeEnabled();
  });

  it('displays generic error message when server error has no message', async () => {
    const genericError = new Error('Network Error');
    const mockRegister = vi.fn().mockRejectedValue(genericError);
    renderComponent(mockRegister);

    fireEvent.change(screen.getByPlaceholderText('PLAYER ALIAS'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('EMAIL ADDRESS'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('PASSWORD'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Claim Seat/i }));

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });

    // Check if the button goes back to active state after loading
    expect(screen.getByRole('button', { name: /Claim Seat/i })).toBeEnabled();
  });
});
