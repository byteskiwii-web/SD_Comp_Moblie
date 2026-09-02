export type AuthStackParamList = {
  Login: undefined;
  ForgotPasswordRequest: { fromFirstLogin?: boolean } | undefined;
  ForgotPasswordVerify: { employeeId: string; maskedEmail: string };
  ResetPassword: { resetToken: string };
};

export type KycStackParamList = {
  KycGate: undefined;
  PanVerify: undefined;
  AadhaarOtpRequest: undefined;
  AadhaarOtpVerify: { referenceId: string };
};
