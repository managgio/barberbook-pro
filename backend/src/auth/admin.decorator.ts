import { SetMetadata } from '@nestjs/common';

export const ADMIN_ENDPOINT_KEY = 'admin-endpoint';

export const AdminEndpoint = () => SetMetadata(ADMIN_ENDPOINT_KEY, true);
