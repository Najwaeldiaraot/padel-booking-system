import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PlayerStories } from "@/components/home/VenueMarketing"
import { MemoryRouter } from "react-router"

describe("PlayerStories Carousel", () => {
  it("renders Google Business rating badge and review slides", () => {
    render(
      <MemoryRouter>
        <PlayerStories />
      </MemoryRouter>
    )
    expect(screen.getAllByText(/Google/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/4\.9/i).length).toBeGreaterThan(0)
  })
})
