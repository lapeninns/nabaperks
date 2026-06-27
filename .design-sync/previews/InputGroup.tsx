import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupButton,
} from "nabaperks"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Globe02Icon } from "@hugeicons/core-free-icons"

export const Default = () => (
  <div className="max-w-md">
    <InputGroup>
      <InputGroupAddon>
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search members or rewards" />
    </InputGroup>
  </div>
)

export const WithPrefix = () => (
  <div className="max-w-md">
    <InputGroup>
      <InputGroupAddon>
        <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
        <InputGroupText>nabaperks.com/</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput defaultValue="bridge-street-coffee" />
    </InputGroup>
  </div>
)

export const WithButton = () => (
  <div className="max-w-md">
    <InputGroup>
      <InputGroupInput placeholder="Enter the 6-digit counter code" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton variant="stamp">Add stamp</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
)

export const WithUnit = () => (
  <div className="max-w-md">
    <InputGroup>
      <InputGroupInput
        type="number"
        defaultValue={8}
        placeholder="Stamps to fill the card"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>stamps</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  </div>
)
