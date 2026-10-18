import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import PhotoSourcePicker from './PhotoSourcePicker';

vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it('offers a library without forced capture and a separate rear camera input', async () => {
  const receive = vi.fn();
  render(<PhotoSourcePicker onFiles={receive} multiple label="Photo"><button>Choose</button></PhotoSourcePicker>);
  const library = screen.getByLabelText('Photo') as HTMLInputElement;
  const camera = screen.getByLabelText('photos.camera: Photo') as HTMLInputElement;
  expect(library).not.toHaveAttribute('capture'); expect(library).toHaveAttribute('multiple');
  expect(camera).toHaveAttribute('capture', 'environment'); expect(camera).not.toHaveAttribute('multiple');
  const openLibrary = vi.spyOn(library, 'click'), openCamera = vi.spyOn(camera, 'click');
  await userEvent.click(screen.getByRole('button', { name: 'Choose' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'photos.camera' }));
  expect(openCamera).toHaveBeenCalledOnce(); expect(openLibrary).not.toHaveBeenCalled();
  const file = new File(['photo'], 'camera.jpg', { type: 'image/jpeg' });
  fireEvent.change(camera, { target: { files: [file] } });
  expect(receive).toHaveBeenCalledWith([file]);
  await userEvent.click(screen.getByRole('button', { name: 'Choose' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'photos.library' }));
  expect(openLibrary).toHaveBeenCalledOnce();
});

it('blocks both sources while processing a photo', () => {
  const receive = vi.fn();
  render(<PhotoSourcePicker onFiles={receive} disabled label="Photo"><button>Choose</button></PhotoSourcePicker>);
  expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
  expect(screen.getByLabelText('Photo')).toBeDisabled();
  expect(screen.getByLabelText('photos.camera: Photo')).toBeDisabled();
});
