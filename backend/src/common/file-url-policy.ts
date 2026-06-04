import { BadRequestException } from '@nestjs/common';

const INTERNAL_FILE_PREFIXES = ['/uploads/', '/files/'];

export function isInternalFileUrl(value: string | null | undefined) {
  if (!value) return false;
  return INTERNAL_FILE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function assertInternalFileUrl(value: string, message = 'Fișierul trebuie încărcat prin Espace.') {
  if (!isInternalFileUrl(value)) {
    throw new BadRequestException(message);
  }
}
