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

/**
 * The Attendance tab is a stack, not a single screen.
 *
 * The day detail is a push rather than a modal or an inline expansion: it is a
 * place you go from a list and come back from, and the back gesture should
 * mean "back to the list" rather than "off the tab".
 *
 * `AttendanceHome` takes params so the detail screen's "Raise Request" can
 * land on the right tab with the right day already selected — the alternative
 * is asking somebody to re-pick the date they were just looking at.
 */
export type AttendanceStackParamList = {
  AttendanceHome: { tab?: 'clock' | 'history' | 'regularise'; date?: string } | undefined;
  AttendanceDay: { date: string };
};

/**
 * Profile is a stack for one reason: bank verification has to hang off
 * something inside the tabs. See ProfileStack.
 */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  BankVerify: undefined;
  // The same three screens KycStack hosts, by the same route names. A check
  // that is still pending has to be completable from Profile, and once the
  // gate is satisfied KycStack no longer exists to reach them through.
  PanVerify: undefined;
  AadhaarOtpRequest: undefined;
  AadhaarOtpVerify: { referenceId: string };
};
