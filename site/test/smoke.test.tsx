import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("smoke", () => {
  it("renders a div", () => {
    render(<div>hi</div>);
    expect(screen.getByText("hi")).toBeInTheDocument();
  });
});
