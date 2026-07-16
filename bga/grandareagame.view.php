<?php
/**
 * Standard BGA view: fills the template placeholders for the game page.
 */

require_once APP_BASE_PATH . 'view/common/game.view.php';

class view_grandareagame_grandareagame extends game_view
{
    public function getGameName()
    {
        return 'grandareagame';
    }

    public function build_page($viewArgs)
    {
        $this->tpl['GRANDAREA_TITLE'] = self::_('Grand Area');
    }
}
