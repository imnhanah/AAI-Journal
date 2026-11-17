import test from 'node:test';
import assert from 'node:assert/strict';
import { signInCallbackError } from './authCallbackError.js';

const read = path => signInCallbackError('http://localhost:3000' + path);

test('maps suppressed Auth hook refusals in query and fragment to fixed restriction copy', () => {
  for (const path of [
    '/?error=server_error&error_description=403%3A+Account+access+unavailable.',
    '/#error=server_error&error_code=unexpected_failure&error_description=Account+access+unavailable.',
    '/login?error=access_denied&error_code=user_banned',
  ]) {
    assert.equal(read(path), 'Sign-in is unavailable for this account. Contact support if you need help.');
  }
});

test('shows neutral sign-in feedback and never echoes provider error descriptions', () => {
  assert.equal(read('/#error=server_error&error_description=Secret+provider+detail'),
    'Sign-in could not be completed. If your account is restricted, contact support.');
  assert.match(read('/?error=access_denied&error_description=User+canceled'), /^Sign-in could not/);
});

test('does not intercept successful callbacks, email recovery, or other app paths', () => {
  for (const path of [
    '/', '/?error_description=Account+access+unavailable.',
    '/#access_token=fixture&refresh_token=fixture&type=recovery',
    '/?code=fixture#access_denied',
    '/?code=fixture#error=server_error',
    '/#error=server_error&type=recovery',
    '/#error=access_denied&error_code=otp_expired',
    '/dashboard?error=access_denied',
  ]) {
    assert.equal(read(path), '', path);
  }
});
