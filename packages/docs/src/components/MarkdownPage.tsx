import { useLocation } from "react-router-dom";

import { getContentItemByPath } from "../config/content";
import { type MarkdownPath, loadMarkdownContent } from "../utils/markdownLoader";
import MarkdownRenderer from "./MarkdownRenderer";

export default function MarkdownPage() {
    const location = useLocation();

    // Get content item based on the current path
    const contentItem = getContentItemByPath(location.pathname);

    if (!contentItem) {
        return (
            <div className="doc-content">
                <div className="max-w-4xl">
                    <h1 className="mb-8 text-3xl font-bold text-gray-900">Page Not Found</h1>
                    <p className="text-gray-600">The requested page could not be found.</p>
                </div>
            </div>
        );
    }

    const content = loadMarkdownContent(contentItem.id as MarkdownPath);

    return (
        <div className="doc-content">
            <div className="max-w-4xl">
                <MarkdownRenderer content={content} />
            </div>
        </div>
    );
}
