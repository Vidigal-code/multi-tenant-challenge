import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotFound from '../../app/not-found';

jest.spyOn(window.history, 'back').mockImplementation(() => {});

describe('NotFound page', () => {
  it('renders and back button calls history.back', () => {
    render(<NotFound />);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(window.history.back).toHaveBeenCalled();
    expect(screen.getByText('Início')).toBeInTheDocument();
  });
});
