import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import NotFound from "@/app/not-found"

describe("NotFound Page", () => {
  it("renders 404 heading and back to home link", () => {
    render(<NotFound />)
    expect(screen.getByText("404")).toBeDefined()
    expect(screen.getByText(/Halaman Tidak Ditemukan/i)).toBeDefined()
    expect(screen.getByText(/Kembali ke Beranda/i)).toBeDefined()
  })
})
