import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from '../../app/profile/page';

jest.mock('../../lib/http', () => ({
  http: {
    get: jest.fn().mockResolvedValue({ data: { id: 'u1', name: 'Test User', email: 'users@example.com' } }),
    post: jest.fn().mockResolvedValue({ data: { id: 'u1', email: 'users@example.com' } }),
    delete: jest.fn().mockResolvedValue({ data: { success: true } }),
  }
}));

const { http } = jest.requireMock('../../lib/http');

describe('ProfilePage', () => {
  it('submits profile update and shows success message', async () => {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ProfilePage />
    </QueryClientProvider>
  );
  expect(await screen.findByDisplayValue('Test User')).toBeInTheDocument();
  expect(screen.getByDisplayValue('users@example.com')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Novo nome'), { target: { value: 'New Name' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar alterações' }).closest('form')!);
    await waitFor(()=> expect(screen.getByText('Perfil atualizado com sucesso')).toBeInTheDocument());
    expect(http.post).toHaveBeenCalledWith('/auth/profile', { name: 'New Name' });
  });

  it('shows errors message on failure', async () => {
  (http.post as jest.Mock).mockRejectedValueOnce({ response: { data: { code: 'NO_FIELDS_TO_UPDATE' } } });
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ProfilePage />
      </QueryClientProvider>
    );
    // Wait for initial profile load so the button label is no longer 'Salvando...'
    const submitBtn = await screen.findByRole('button', { name: 'Salvar alterações' });
    fireEvent.submit(submitBtn.closest('form')!);
  await waitFor(()=> {
    const errorElement = screen.getByTestId('profile-error');
    expect(errorElement).toHaveTextContent('Nenhuma alteração detectada — nenhum campo foi atualizado.');
  }, { timeout: 5000 });
  });
});
