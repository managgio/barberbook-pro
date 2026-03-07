import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { DomainError } from '@/shared/domain/domain-error';
import { rethrowDomainErrorAsHttp } from '@/shared/interfaces/http/rethrow-domain-error-as-http';

test('rethrowDomainErrorAsHttp ignores non-domain errors', () => {
  assert.doesNotThrow(() => {
    rethrowDomainErrorAsHttp(new Error('not-domain'), {
      FOO: () => new BadRequestException('foo'),
    });
  });
});

test('rethrowDomainErrorAsHttp ignores domain error with non-mapped code', () => {
  assert.doesNotThrow(() => {
    rethrowDomainErrorAsHttp(new DomainError('bar', 'BAR'), {
      FOO: () => new BadRequestException('foo'),
    });
  });
});

test('rethrowDomainErrorAsHttp throws mapped http exception', () => {
  assert.throws(
    () => {
      rethrowDomainErrorAsHttp(new DomainError('foo', 'FOO'), {
        FOO: () => new BadRequestException('mapped-foo'),
      });
    },
    (error: unknown) =>
      error instanceof BadRequestException &&
      String(error.message).includes('mapped-foo'),
  );
});
