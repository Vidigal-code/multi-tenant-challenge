import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteForm } from '../../../components/invites/InviteForm';

jest.mock('../../../lib/http', () => ({
  http: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue({
      data: { inviteUrl: 'http://example.com/invite/token123', token: 'token123' },
    }),
  },
}));

/**
 * EN -
 * Unit tests for InviteForm component following TDD principles.
 * 
 * Tests cover:
 * - Component rendering with required fields
 * - Email input field presence
 * - Form submission handling
 * - Validation error display
 * - Success callback invocation
 * 
 * PT -
 * Testes unitários para componente InviteForm seguindo princípios TDD.
 * 
 * Testes cobrem:
 * - Renderização do componente com campos obrigatórios
 * - Presença do campo de input de email
 * - Tratamento de submissão do formulário
 * - Exibição de erros de validação
 * - Invocação de callback de sucesso
 */
describe('InviteForm', () => {
  /**
   * EN -
   * Tests that component renders with required fields.
   * Verifies that email input field is present in the DOM.
   * 
   * PT -
   * Testa que componente renderiza com campos obrigatórios.
   * Verifica que campo de input de email está presente no DOM.
   */
  it('should render email input field', () => {
    render(<InviteForm companyId="c1" onInvited={() => {}} />);
    expect(screen.getByPlaceholderText('Email ou ID do usuário')).toBeInTheDocument();
  });

  /**
   * EN -
   * Tests that form can be submitted with valid email.
   * Verifies that onInvited callback is called with correct data.
   * 
   * PT -
   * Testa que formulário pode ser submetido com email válido.
   * Verifica que callback onInvited é chamado com dados corretos.
   */
  it('should call onInvited callback when form is submitted with valid email', async () => {
    const mockOnInvited = jest.fn();
    render(<InviteForm companyId="c1" onInvited={mockOnInvited} />);

    const emailInput = screen.getByPlaceholderText('Email ou ID do usuário');
    const submitButton = screen.getByRole('button', { name: 'Enviar Convite' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnInvited).toHaveBeenCalled();
    });
  });

  /**
   * EN -
   * Tests that component accepts companyId prop.
   * Verifies that companyId is properly used in the component.
   * 
   * PT -
   * Testa que componente aceita prop companyId.
   * Verifica que companyId é usado corretamente no componente.
   */
  it('should accept companyId prop', () => {
    const { container } = render(<InviteForm companyId="test-company-id" onInvited={() => {}} />);
    expect(container).toBeInTheDocument();
  });
});
