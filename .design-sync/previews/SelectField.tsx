import { FormField, SelectField } from "nabaperks"

export const Default = () => (
  <div className="max-w-xs">
    <SelectField defaultValue="cafe" aria-label="Venue type">
      <option value="cafe">Café / coffee shop</option>
      <option value="bakery">Bakery</option>
      <option value="pub">Pub / taproom</option>
      <option value="salon">Salon / barber</option>
    </SelectField>
  </div>
)

export const InFormField = () => (
  <div className="max-w-xs">
    <FormField
      id="stamps-per-card"
      label="Stamps per card"
      description="How many visits earn the reward."
    >
      <SelectField id="stamps-per-card" defaultValue="8">
        <option value="6">6 stamps</option>
        <option value="8">8 stamps</option>
        <option value="10">10 stamps</option>
      </SelectField>
    </FormField>
  </div>
)

export const Disabled = () => (
  <div className="max-w-xs">
    <SelectField defaultValue="live" disabled aria-label="Card status">
      <option value="live">Live — collecting stamps</option>
    </SelectField>
  </div>
)
