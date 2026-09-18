import { ResetPasswordForm } from '../../components/reset-password-form';
export const metadata = {
  title: '重設密碼 · TURBOX',
  referrer: 'no-referrer' as const,
};
export default function Page() {
  return <ResetPasswordForm />;
}
