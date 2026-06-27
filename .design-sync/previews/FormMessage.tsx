import { FormMessage } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <FormMessage>That passcode has expired. Request a fresh code to continue.</FormMessage>
  </div>
)

export const WithId = () => (
  <div className="max-w-md">
    <FormMessage id="member-phone-error">
      Enter the 6-digit code we texted to your mobile.
    </FormMessage>
  </div>
)
