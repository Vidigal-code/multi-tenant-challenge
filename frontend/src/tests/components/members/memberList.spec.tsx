import { render, screen } from '@testing-library/react';
import { MemberList } from '../../../components/members/MemberList';

describe('MemberList', () => {
  const baseProps = {
    currentRole: 'OWNER' as const,
    onDelete: jest.fn(),
    onChangeRole: jest.fn(),
    onMemberClick: jest.fn(),
  };

  it('shows empty message', () => {
    render(<MemberList members={[]} {...baseProps} />);
    expect(screen.getByText('Ainda não há membros.')).toBeInTheDocument();
  });

  it('renders rows', () => {
    render(<MemberList members={[{ id: '1', userId: 'u1', role: 'OWNER' }]} {...baseProps} />);
    expect(screen.getByText('PROPRIETÁRIO')).toBeInTheDocument();
  });
});
