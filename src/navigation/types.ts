export type AuthStackParamList = {
  Login: undefined;
  ForgotPasswordRequest: { fromFirstLogin?: boolean } | undefined;
  ForgotPasswordVerify: { employeeId: string; maskedEmail: string };
  ResetPassword: { resetToken: string };
};

/**
 * The onboarding checklist and the screens it opens. PanVerify /
 * AadhaarOtp* / BankVerify are the same components ProfileStack hosts, so
 * their param shapes must stay identical between the two.
 */
export type OnboardingStackParamList = {
  OnboardingChecklist: undefined;
  CompleteProfile: undefined;
  PanVerify: undefined;
  AadhaarOtpRequest: undefined;
  AadhaarOtpVerify: { referenceId: string };
  BankVerify: undefined;
  FaceRegister: undefined;
};

/** @deprecated the KYC gate is now part of OnboardingStack; kept for the verification screens' typings. */
export type KycStackParamList = OnboardingStackParamList;

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
  // autoPunch makes arriving here equivalent to arriving AND tapping the
  // button, for a caller that already knows the direction. Home used to pass
  // it; it now punches in place, so nothing sets it today -- see ClockPanel.
  AttendanceHome:
    | { tab?: 'clock' | 'history' | 'regularise'; date?: string; autoPunch?: 'clock-in' | 'clock-out' }
    | undefined;
  /*
   * employeeId is how a team lead opens somebody else's day.
   *
   * Absent means "mine", which is every existing caller. The name rides along
   * only so the screen can title itself without a second request -- the day's
   * marks are still fetched fresh, because a lead lands here to check what was
   * recorded, and a value copied out of a list at tap time is not that.
   */
  AttendanceDay: { date: string; employeeId?: string; employeeName?: string };
};

/**
 * Profile is a stack for one reason: bank verification has to hang off
 * something inside the tabs. See ProfileStack.
 */
export type HomeStackParamList = {
  HomeMain: undefined;
  Festivals: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  // One screen per topic, reached from the hub's menu. Each holds the card
  // (or two) that used to sit on the long Profile page.
  WorkDetails: undefined;
  Identity: undefined;
  Documents: undefined;
  Personal: undefined;
  Kit: undefined;
  Policies: undefined;
  Preferences: undefined;
  Account: undefined;
  BankVerify: undefined;
  // The same screens OnboardingStack hosts, by the same route names. A check
  // that later fails has to be redoable from Profile, and once HR approves
  // the employee OnboardingStack no longer exists to reach them through.
  PanVerify: undefined;
  AadhaarOtpRequest: undefined;
  AadhaarOtpVerify: { referenceId: string };
  FaceRegister: undefined;
};
