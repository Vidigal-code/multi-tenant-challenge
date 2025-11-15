import { render, screen } from '@testing-library/react';
import DashboardPage from '../../app/dashboard/page';

describe('DashboardPage', () => {
  it('renders header', () => {
    render(<DashboardPage />);
    expect(screen.getByText('My Companies')).toBeInTheDocument();
  });
});
