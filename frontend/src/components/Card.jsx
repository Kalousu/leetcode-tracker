import { Card as HCard, Chip } from "@heroui/react"
import "./Card.css"

function Card({ id, title, difficulty, content, tags = [] }) {
    return (
        <HCard className="w-full">
            <HCard.Header>
                <HCard.Title>{id}. {title}</HCard.Title>
                <HCard.Description>{difficulty}</HCard.Description>
            </HCard.Header>
            <HCard.Content className="gap-3">
                <div className="flex flex-wrap gap-2">
                    {tags.map((t) => <Chip key={t.name}>{t.name}</Chip>)}
                </div>
                {/* content ist HTML von LeetCode */}
                <div className="description" dangerouslySetInnerHTML={{ __html: content }} />
            </HCard.Content>
        </HCard>
    )
}

export default Card;
