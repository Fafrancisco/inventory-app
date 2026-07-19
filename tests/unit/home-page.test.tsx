import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function createJsonResponse(data: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
  } as Response;
}

describe("Home page loading", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/stock") {
        return createJsonResponse([]);
      }

      if (url === "/api/config/products") {
        return createJsonResponse([{ id: 1, nome: "Arroz", unidade: "kg" }]);
      }

      if (url === "/api/config/locations") {
        return createJsonResponse([{ id: 1, nome: "Cozinha" }]);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not load config data during the initial page render", async () => {
    render(<Home />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "+ Novo" })).toBeInTheDocument()
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/stock");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/config/products");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/config/locations");
  });

  it("loads config data when the add-item form is opened", async () => {
    const user = userEvent.setup();

    render(<Home />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "+ Novo" })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "+ Novo" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/config/products")
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/config/locations");
  });
});
