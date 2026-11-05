import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import ClubQuestions, { WhatsAppHelp } from "@/components/booking/BookingSupport"
import { MemoryRouter } from "react-router"

describe("ClubQuestions with WhatsApp Help", () => {
  it("includes WhatsApp help at the bottom of FAQ", () => {
    render(
      <MemoryRouter>
        <ClubQuestions />
      </MemoryRouter>
    )
    expect(screen.getByText(/Masih ada yang ingin ditanyakan\?/i)).toBeDefined()
    expect(screen.getByText(/Tanya via WhatsApp/i)).toBeDefined()
  })

  it("renders WhatsAppHelp with dynamic whatsapp number link", () => {
    render(
      <MemoryRouter>
        <WhatsAppHelp />
      </MemoryRouter>
    )
    const link = screen.getByRole("link", { name: /Tanya via WhatsApp/i })
    expect(link).toBeDefined()
    expect(link.getAttribute("href")).toContain("https://wa.me/")
  })
})
