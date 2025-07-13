import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Box, useTheme } from '@mui/material'
import type { Components } from 'react-markdown'

type MarkdownRendererProps = {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const theme = useTheme()
  const isDarkMode = theme.palette.mode === 'dark'

  const components: Components = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || '')
      return match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className}>
          {children}
        </code>
      )
    },
  }

  return (
    <Box 
      className={`doc-prose ${className || ''}`}
      sx={{
        '& h1': {
          fontSize: '2.5rem',
          fontWeight: 700,
          marginBottom: '2rem',
          color: 'primary.main',
        },
        '& h2': {
          fontSize: '2rem',
          fontWeight: 600,
          marginTop: '3rem',
          marginBottom: '1.5rem',
          color: 'primary.main',
        },
        '& h3': {
          fontSize: '1.5rem',
          fontWeight: 500,
          marginTop: '2rem',
          marginBottom: '1rem',
          color: 'primary.main',
        },
        '& h4': {
          fontSize: '1.25rem',
          fontWeight: 500,
          marginTop: '1.5rem',
          marginBottom: '0.75rem',
          color: 'primary.main',
        },
        '& p': {
          marginBottom: '1rem',
          lineHeight: 1.6,
          color: 'text.secondary',
        },
        '& ul, & ol': {
          marginBottom: '1rem',
          paddingLeft: '2rem',
        },
        '& li': {
          marginBottom: '0.5rem',
          color: 'text.secondary',
        },
        '& blockquote': {
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          paddingLeft: '1rem',
          margin: '1rem 0',
          fontStyle: 'italic',
          color: 'text.secondary',
        },
        '& code': {
          backgroundColor: isDarkMode ? '#2d2d2d' : '#f5f5f5',
          color: isDarkMode ? '#ff8a80' : '#d32f2f',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.9em',
          fontFamily: 'JetBrains Mono, monospace',
        },
        '& pre': {
          backgroundColor: isDarkMode ? '#1a1a1a' : '#263238',
          color: '#eeffff',
          padding: '16px',
          borderRadius: '8px',
          overflow: 'auto',
          margin: '1rem 0',
        },
        '& pre code': {
          backgroundColor: 'transparent',
          color: 'inherit',
          padding: 0,
        },
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          margin: '1rem 0',
        },
        '& th, & td': {
          border: `1px solid ${theme.palette.divider}`,
          padding: '8px 12px',
          textAlign: 'left',
        },
        '& th': {
          backgroundColor: theme.palette.action.hover,
          fontWeight: 600,
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          margin: '1rem 0',
        },
        '& hr': {
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
          margin: '2rem 0',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  )
} 