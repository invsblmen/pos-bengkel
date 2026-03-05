<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartCategoryCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $partCategory;

    /**
     * Create a new event instance.
     */
    public function __construct(array $partCategory)
    {
        $this->partCategory = $partCategory;
    }

    public function broadcastAs(): string
    {
        return 'partcategory.created';
    }

    public function broadcastWith(): array
    {
        return [
            'partCategory' => $this->partCategory,
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('workshop.partcategories'),
        ];
    }
}
