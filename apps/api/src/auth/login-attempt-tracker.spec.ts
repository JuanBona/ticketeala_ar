// Unit tests of the D34 login limit keys: the account key ignores the IP and the IP key ignores the email.
import { trackLoginByEmail, trackLoginByIp } from './login-attempt-tracker.js';

describe('login attempt trackers', () => {
  it('D34: attempts on one account from different IPs share the same key', () => {
    const fromFirstIp = { ip: '10.0.0.1', body: { email: 'ana@example.com' } };
    const fromSecondIp = { ip: '10.0.0.2', body: { email: 'ana@example.com' } };

    expect(trackLoginByEmail(fromFirstIp)).toBe(
      trackLoginByEmail(fromSecondIp),
    );
  });

  it('D34: the account key ignores capitals and surrounding spaces', () => {
    const typedLoosely = {
      ip: '10.0.0.1',
      body: { email: ' Ana@Example.com ' },
    };

    expect(trackLoginByEmail(typedLoosely)).toBe('ana@example.com');
  });

  it('D34: attempts on different accounts from one IP share the same key', () => {
    const onFirstAccount = {
      ip: '10.0.0.1',
      body: { email: 'ana@example.com' },
    };
    const onSecondAccount = {
      ip: '10.0.0.1',
      body: { email: 'luis@example.com' },
    };

    expect(trackLoginByIp(onFirstAccount)).toBe(
      trackLoginByIp(onSecondAccount),
    );
  });
});
