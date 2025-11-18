import { render, screen } from '@testing-library/react';
import { InviteForm } from '../../../components/invites/InviteForm';

describe('InviteForm', () => {
  it('renders fields', () => {
    render(<InviteForm companyId="c1" onInvited={()=>{}} />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });
});
