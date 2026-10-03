"""Exception hierarchy mapped to the stable error schema (code-standards §7).

Error responses never carry stack traces, paths or SQL. Codes are stable
strings — clients switch on `code`, never on message text.
"""
from __future__ import annotations


class SathiError(Exception):
    code = "INTERNAL"
    status = 500
    message_bn = "একটি সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।"
    message_en = "Something went wrong. Please try again shortly."

    def __init__(self, message_bn: str | None = None, message_en: str | None = None):
        super().__init__(self.code)
        if message_bn is not None:
            self.message_bn = message_bn
        if message_en is not None:
            self.message_en = message_en


class UnauthenticatedError(SathiError):
    code = "UNAUTHENTICATED"
    status = 401
    message_bn = "প্রবেশের টোকেন সঠিক নয়। আবার ব্যবহারকারী নির্বাচন করুন।"
    message_en = "The access token is missing or invalid. Please pick a demo user again."


class ForbiddenError(SathiError):
    code = "FORBIDDEN"
    status = 403
    message_bn = "এই তথ্য দেখার অনুমতি নেই।"
    message_en = "You do not have access to this data."


class NotFoundError(SathiError):
    code = "NOT_FOUND"
    status = 404
    message_bn = "খুঁজে পাওয়া যায়নি।"
    message_en = "Not found."


class ValidationFailedError(SathiError):
    code = "VALIDATION_FAILED"
    status = 400
    message_bn = "দেওয়া তথ্য ঠিক নেই। আবার দেখে চেষ্টা করুন।"
    message_en = "The provided input is not valid. Please check and try again."


class GoalInvalidError(SathiError):
    code = "GOAL_INVALID"
    status = 422
    message_bn = "লক্ষ্যটি ঠিক নেই — পরিমাণ ও সময়সীমা যাচাই করুন।"
    message_en = "The goal is not valid — check the amount and the time frame."


class AmountUnclearError(SathiError):
    code = "AMOUNT_UNCLEAR"
    status = 422
    message_bn = "পরিমাণটা বোঝা যায়নি। যেমন লিখতে পারেন: ৩০ হাজার বা 30000।"
    message_en = "Could not understand the amount. For example: ৩০ হাজার or 30000."


class RateLimitedError(SathiError):
    code = "RATE_LIMITED"
    status = 429
    message_bn = "একটু ধীরে — কিছুক্ষণ পর আবার চেষ্টা করুন।"
    message_en = "Slow down a little — please try again shortly."


class UpstreamError(SathiError):
    code = "UPSTREAM_ERROR"
    status = 502
    message_bn = "সংযুক্ত সেবায় সমস্যা হয়েছে।"
    message_en = "A connected service failed."
