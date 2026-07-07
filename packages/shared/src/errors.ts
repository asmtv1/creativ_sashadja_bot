export const ApiErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  COURSE_NOT_FOUND: "COURSE_NOT_FOUND",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  PAYMENT_NOT_CONFIRMED: "PAYMENT_NOT_CONFIRMED",
  ACCESS_REQUIRED: "ACCESS_REQUIRED"
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type ApiErrorResponse = {
  code: ApiErrorCode;
  message: string;
};
