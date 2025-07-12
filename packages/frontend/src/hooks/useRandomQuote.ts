import { useQuery } from "@tanstack/react-query";

interface Quote {
    id: number;
    content: string;
    author: string;
}

async function fetchRandomQuote(): Promise<Quote> {
    const response = await fetch("https://quotable.io/random");
    if (!response.ok) {
        throw new Error("Failed to fetch quote");
    }
    const data = await response.json();
    return { id: data._id, content: data.content, author: data.author };
}

export function useRandomQuote() {
    return useQuery({ queryKey: ["randomQuote"], queryFn: fetchRandomQuote, refetchOnWindowFocus: false, retry: 2 });
}
