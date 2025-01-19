
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Image } from '../../components/conversation/Image';

describe('Image component', () => {
  const defaultProps = {
    alt: 'Test image',
    attachment: {},
    i18n: (key) => key,
    theme: 'light',
  };

  it('should not show "media no longer available" for stickers', () => {
    const props = {
      ...defaultProps,
      attachment: { contentType: 'image/webp' },
      isSticker: true,
    };
    const { queryByText } = render(<Image {...props} />);
    expect(queryByText('icu:imageNoLongerAvailable')).toBeNull();
  });

  it('should not show "media no longer available" for local attachments', () => {
    const props = {
      ...defaultProps,
      attachment: { path: '/local/path/to/image.jpg' },
    };
    const { queryByText } = render(<Image {...props} />);
    expect(queryByText('icu:imageNoLongerAvailable')).toBeNull();
  });

  it('should show "media no longer available" for non-downloadable, non-local, non-sticker attachments', () => {
    const props = {
      ...defaultProps,
      attachment: { contentType: 'image/jpeg' },
    };
    const { getByText } = render(<Image {...props} />);
    expect(getByText('icu:imageNoLongerAvailable')).toBeInTheDocument();
  });

  it('should not show "media no longer available" for downloadable attachments', () => {
    const props = {
      ...defaultProps,
      attachment: { contentType: 'image/jpeg' },
      isDownloadable: true,
    };
    const { queryByText } = render(<Image {...props} />);
    expect(queryByText('icu:imageNoLongerAvailable')).toBeNull();
  });
});
