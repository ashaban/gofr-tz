<template>
  <v-container fluid>
    {{$store.state.activeDataSourcePair}}
    <template v-if='$store.state.uploadRunning'><br><br><br>
      <v-alert
        type="info"
        :value="true"
      >
        <b>Wait for upload to finish ...</b>
        <v-progress-linear
          indeterminate
          color="white"
          class="mb-0"
        ></v-progress-linear>
      </v-alert>
    </template>
    <v-container
      fluid
      grid-list-lg
      v-if='!$store.state.denyAccess & !$store.state.uploadRunning'
    >
      <v-dialog
        v-model="$store.state.scoresProgressData.scoreDialog"
        hide-overlay
        persistent
        width="350"
      >
        <v-card
          color="white"
          dark
        >
          <v-card-text>
            <center>
              <font style="color:blue">{{$store.state.scoresProgressData.scoreProgressTitle}}</font><br>
              <v-progress-circular
                :rotate="-90"
                :size="100"
                :width="15"
                :value="$store.state.scoresProgressData.scoreProgressPercent"
                color="primary"
                v-if="$store.state.scoresProgressData.progressType == 'percent'"
              >
                <v-avatar
                  color="indigo"
                  size="50px"
                >
                  <span class="white--text">
                    <b>{{ $store.state.scoresProgressData.scoreProgressPercent }}%</b>
                  </span>
                </v-avatar>
              </v-progress-circular>
              <v-progress-linear
                indeterminate
                color="red"
                class="mb-0"
                v-if="$store.state.scoresProgressData.progressType == 'indeterminate'"
              ></v-progress-linear>
            </center>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-dialog
        persistent
        v-model="alert"
        width="500px"
      >
        <v-card>
          <v-toolbar
            color="primary"
            dark
          >
            <v-toolbar-title>
              {{alertTitle}}
            </v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            {{alertText}}
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="success"
              @click='alert = false'
            >OK</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-dialog
        persistent
        v-model="flagCommentDialog"
        width="500px"
      >
        <v-card>
          <v-toolbar
            color="primary"
            dark
          >
            <v-toolbar-title>
              Add comment for this flag if any
            </v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-textarea
              v-model="flagComment"
              auto-grow
              box
              color="deep-purple"
              label="Flag Comment"
              rows="1"
            ></v-textarea>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="success"
              @click='flag'
            >Continue</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-dialog
        persistent
        transition="scale-transition"
        v-model="dialog"
        :width="dialogWidth"
      >
        <v-card :width='dialogWidth'>
          <v-toolbar
            color="primary"
            dark
          >
            <v-toolbar-title>
              Matching {{ selectedSource1Name }}
            </v-toolbar-title>
            <v-spacer></v-spacer>
            <v-text-field
              v-model="searchPotential"
              append-icon="search"
              label="Search"
              single-line
              hide-details
              color="yellow"
            />
            <v-btn
              icon
              dark
              @click.native="back"
            >
              <v-icon>close</v-icon>
            </v-btn>
          </v-toolbar>
          <v-card-title>
            Parents:
            <b>{{selectedSource1Parents | joinParentsAndReverse}}</b>
            <v-spacer></v-spacer>
            Code: <b>{{selectedSource1Code}}</b>
            <v-spacer></v-spacer>
            <template v-if='$store.state.recoLevel == $store.state.totalSource1Levels'>
              Latitude:
              <b>{{selectedSource1Lat}}</b>
              <v-spacer></v-spacer>
              Longitude:
              <b>{{selectedSource1Long}}</b>
              <v-spacer></v-spacer>
            </template>
          </v-card-title>
          <v-card-text>
            <b>Potential Matches</b>
            <v-data-table
              :headers="potentialHeaders"
              :items="allPotentialMatches"
              :search="searchPotential"
              :pagination.sync="pagination"
              class="elevation-1"
              :sort-desc="[false]"
            >
              <template
                slot="headers"
                slot-scope="props"
              >
                <tr>
                  <template v-for='header in potentialHeaders'>
                    <th
                      :key='header.text'
                      align='left'
                      v-if="header.text == 'Score'"
                      class="column sortable active"
                      @click="changeSort(header.value)"
                    >
                      <v-icon
                        small
                        v-if="sort_arrow == 'up'"
                      >arrow_upward</v-icon>
                      <v-icon
                        small
                        v-else
                      >arrow_downward</v-icon>
                      {{header.text}}
                      <v-tooltip top>
                        <v-btn
                          slot="activator"
                          icon
                        >
                          <v-icon>help</v-icon>
                        </v-btn>
                        <span>The higher the score, the better the match</span>
                      </v-tooltip>
                    </th>
                    <th
                      :key='header.text'
                      align='left'
                      v-else
                    >
                      {{header.text}}
                    </th>
                  </template>
                </tr>
              </template>
              <template
                slot="items"
                slot-scope="props"
              >
                <tr>
                  <td>
                    <v-tooltip top>
                      <v-btn
                        color="error"
                        small
                        @click.native="match('flag', props.item.id, props.item.name, props.item.uuid, props.item.mappedParentName)"
                        slot="activator"
                      >
                        <v-icon
                          dark
                          left
                        >notification_important</v-icon>Flag
                      </v-btn>
                      <span>Mark the selected item as a match to be reviewed</span>
                    </v-tooltip>
                    <v-tooltip top>
                      <v-btn
                        color="primary"
                        small
                        dark
                        @click.native="match('match', props.item.id, props.item.name, props.item.uuid)"
                        slot="activator"
                      >
                        <v-icon left>thumb_up</v-icon>Save Match
                      </v-btn>
                      <span>Save the selected item as a match</span>
                    </v-tooltip>
                  </td>
                  <td>{{props.item.name}}</td>
                  <td>{{props.item.code}}</td>
                  <td>{{props.item.parents | joinParentsAndReverse}}</td>
                  <td>{{props.item.score}}</td>
                  <td>{{potentialMatchComment(props.item)}}</td>
                </tr>
              </template>
            </v-data-table>
          </v-card-text>
          <v-card-actions style='float: center'>
            <v-layout
              row
              wrap
            >
              <v-flex xs5>
                <v-tooltip top>
                  <v-btn
                    v-if='potentialAvailable'
                    color="teal darken-6"
                    style="color: white"
                    slot="activator"
                    @click="showAllPotential = !showAllPotential"
                  >
                    <template v-if="showAllPotential">Show Scored Suggestions</template>
                    <template v-else>Show All Suggestions</template>
                  </v-btn>
                  <span v-if="showAllPotential">Limit to only scored suggestions</span>
                  <span v-else>See all possible choices ignoring the score</span>
                </v-tooltip>
              </v-flex>
              <v-spacer></v-spacer>
              <v-flex
                xs6
                text-sm-right
              >
                <v-tooltip top>
                  <v-btn
                    color="orange darken-2"
                    @click.native="back"
                    style="color: white"
                    slot="activator"
                  >
                    <v-icon
                      dark
                      left
                    >arrow_back</v-icon>Back
                  </v-btn>
                  <span>Return without saving</span>
                </v-tooltip>
              </v-flex>
            </v-layout>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-layout
        row
        wrap
      >
        <v-flex xs5>
          <v-autocomplete
            :items="source1ParentNames"
            @change="filterByParent"
            label="Filter by District"
            clearable
          ></v-autocomplete>
        </v-flex>
        <v-spacer></v-spacer>
        <v-flex xs2>
          <v-btn
            v-if='!$store.state.scoreSavingProgressData.savingMatches'
            slot="activator"
            color="primary"
            dark
            @click="getScores"
            round
          >
            <v-icon>repeat_one</v-icon> Recalculate Scores
          </v-btn>
          <template v-else>
            Saving matches for {{translateDataHeader('source1', $store.state.recoLevel - 2)}}
            <v-progress-linear
              color="error"
              width="20"
              height="20"
              :value="$store.state.scoreSavingProgressData.percent"
            >
              <center>
                <span class="green--text"><b>{{$store.state.scoreSavingProgressData.percent}}%</b></span>
              </center>
            </v-progress-linear>
          </template>
        </v-flex>
        <v-flex
          xs1
          text-xs-right
        >
          <v-tooltip top>
            <v-btn
              flat
              icon
              color="primary"
              @click="helpDialog = true"
              slot="activator"
            >
              <v-icon>help</v-icon>
            </v-btn>
            <span>Help</span>
          </v-tooltip>
        </v-flex>
      </v-layout>
      <v-dialog
        v-model="helpDialog"
        scrollable
        persistent
        :overlay="false"
        max-width="700px"
        transition="dialog-transition"
      >
        <v-card>
          <v-toolbar
            color="primary"
            dark
          >
            <v-toolbar-title>
              <v-icon>info</v-icon> About this page
            </v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn
              icon
              dark
              @click.native="helpDialog = false"
            >
              <v-icon>close</v-icon>
            </v-btn>
          </v-toolbar>
          <v-card-text>
            This page let you map source 1 data with those in source2
            <v-list>
              1. Source 1 refer to the data source name selected as source 1 under data source pair section
            </v-list>
            <v-list>
              2. Source 2 refer to the data source name selected as source 2 under data source pair section
            </v-list>
            <v-list>
              3. After breaking a match, you will need to recalculate scores for the app to load potential matches of the broken location
            </v-list>
            <v-list>
              4. FLAGGED Locations are the locations that will need to be reviewed before they are saved as matches
            </v-list>
            <v-list>
              5. NO MATCHES - these are locations that do not matches anything from source 2
            </v-list>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-layout
        row
        wrap
      >
        <v-flex
          xs2
          right
        >
          <div style="border-style: solid;border-color:green; text-align: center;">
            <b>
              <template v-if="$store.state.activePair.source1 && Object.keys($store.state.activePair.source1).length > 0">
                {{$store.state.activePair.source1.name.toUpperCase()}}
              </template> Reconciliation Status</b>

            <v-layout
              row
              wrap
            >
              <v-flex xs6>
                <v-layout column>
                  <v-flex>
                    <b>Matched</b>
                  </v-flex>
                  <v-flex align-center>
                    <center>
                      <b>{{source1TotalMatched}}/{{source1TotalRecords}}</b>
                    </center>
                  </v-flex>
                  <v-flex>
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source1PercentMatched"
                        color="green"
                      >
                        <font color="black">
                          <b>{{ source1PercentMatched }}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
              <v-flex xs6>
                <v-layout column>
                  <v-flex align-center>
                    <b>Unmatched</b>
                  </v-flex>
                  <v-flex xs1>
                    <center>
                      <b>{{source1TotalUnMatched}}/{{source1TotalRecords}}</b>
                    </center>
                  </v-flex>
                  <v-flex
                    xs1
                    align-center
                  >
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source1PercentUnMatched"
                        color="red"
                      >
                        <font color="black">
                          <b>{{source1PercentUnMatched}}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
            </v-layout>
            <v-layout
              row
              wrap
            >
              <v-flex xs6>
                <v-layout column>
                  <v-flex align-center>
                    <b>Flagged</b>
                  </v-flex>
                  <v-flex xs1>
                    <center>
                      <b>{{totalFlagged}}/{{source1TotalRecords}}</b>
                    </center>
                  </v-flex>
                  <v-flex
                    xs1
                    align-center
                  >
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source1PercentFlagged"
                        color="orange"
                      >
                        <font color="black">
                          <b>{{source1PercentFlagged}}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
            </v-layout>
          </div>
        </v-flex>
        <v-flex
          xs4
          child-flex
        >
          <v-card color="green lighten-2">
            <v-card-title primary-title>
              Unmatched in
              <template v-if="Object.keys($store.state.activePair.source1).length > 0">
                {{$store.state.activePair.source1.name.toUpperCase()}}
              </template>
              <v-spacer></v-spacer>
              <v-text-field
                @input="filterSrc1Unmatched"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
            </v-card-title>
            <template v-if='!loadingSource1Unmatched'>
              <liquor-tree
                :data="source1Tree"
                ref="source1Tree"
                :key="source1TreeUpdate"
              />
              <v-data-table
                :headers="source1GridHeaders"
                :items="source1Grid"
                :search="filtersForSrc1Unmatched"
                :custom-filter="customFilter"
                light
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td
                    v-if="$store.state.recoStatus === 'Done'"
                    :key='props.item.id'
                  >{{props.item.name}}</td>
                  <td
                    v-else
                    @click="getPotentialMatch(props.item.id)"
                    style="cursor: pointer"
                    :key='props.item.id'
                  >
                    {{props.item.name}} <br>&ensp;&ensp;{{props.item.parents.join('->')}}
                  </td>
                  <td>{{props.item.code}}</td>
                  <td
                    v-for="(parent,index) in props.item.parents"
                    v-if='index !=props.item.parents.length-1'
                    :key='props.item.id+index'
                  >
                    {{parent}}
                  </td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              ></v-progress-linear>
            </template>
          </v-card>
        </v-flex>
        <v-flex xs4>
          <v-card
            color="blue lighten-2"
            dark
          >
            <v-card-title primary-title>
              Unmatched in
              <template v-if="$store.state.activePair.source2 && Object.keys($store.state.activePair.source2).length > 0">
                {{$store.state.activePair.source2.name.toUpperCase()}}
              </template>
              <v-spacer></v-spacer>
              <v-text-field
                v-model="searchUnmatchedSource2"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
            </v-card-title>
            <template v-if='!loadingSource2Unmatched'>
              <v-data-table
                :headers="source1UnmatchedHeaders"
                :items="$store.state.source2UnMatched"
                :search="searchUnmatchedSource2"
                light
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td>{{props.item.name}} <br>&ensp;&ensp;{{props.item.parents | joinParentsAndReverse}}</td>
                  <td>{{props.item.code}}</td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              ></v-progress-linear>
            </template>
          </v-card>
        </v-flex>

        <v-flex
          xs2
          right
        >
          <div style='border-style: solid;border-color: green; text-align: center;'>
            <b>
              <template v-if="Object.keys($store.state.activePair.source2).length > 0">
                {{$store.state.activePair.source2.name.toUpperCase()}}
              </template>
               Reconciliation Status
            </b>
            <v-layout
              row
              wrap
            >
              <v-flex xs6>
                <v-layout column>
                  <v-flex align-center>
                    <b>Matched</b>
                  </v-flex>
                  <v-flex xs1>
                    <center>
                      <b>{{source2TotalMatched}}/{{source2TotalRecords}}</b>
                    </center>
                  </v-flex>
                  <v-flex
                    xs1
                    align-center
                  >
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source2PercentMatched"
                        color="green"
                      >
                        <font color="black">
                          <b>{{source2PercentMatched}}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
              <v-flex xs6>
                <v-layout column>
                  <v-flex xs1>
                    <b>Unmatched</b>
                  </v-flex>
                  <v-flex
                    xs1
                    align-center
                  >
                    <center>
                      <b>{{source2TotalUnmatched}}/{{source2TotalRecords}}</b>
                    </center>
                  </v-flex>
                  <v-flex xs1>
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source2PercentUnmatched"
                        color="red"
                      >
                        <font color="black">
                          <b>{{ source2PercentUnmatched }}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
            </v-layout>
            <v-layout
              row
              wrap
            >
              <v-flex xs6>
                <v-layout column>
                  <v-flex align-center>
                    <b>Flagged</b>
                  </v-flex>
                  <v-flex xs1>
                    <center>
                      <b>{{totalFlagged}}/{{source2TotalRecords}}</b>
                    </center>
                  </v-flex>
                  <v-flex
                    xs1
                    align-center
                  >
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source2PercentFlagged"
                        color="orange"
                      >
                        <font color="black">
                          <b>{{source2PercentFlagged}}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
              <v-flex xs6>
                <v-layout column>
                  <v-flex align-center>
                    <b>
                      Not in
                      <template v-if="Object.keys($store.state.activePair.source1).length > 0">
                        {{$store.state.activePair.source1.name.toUpperCase()}}
                      </template>
                    </b>
                  </v-flex>
                  <v-flex xs1>
                    <center>
                      <b>{{source2NotInSource1}}</b>
                    </center>
                  </v-flex>
                  <v-flex
                    xs1
                    align-center
                  >
                    <center>
                      <v-progress-circular
                        :rotate="-90"
                        :size="65"
                        :width="8"
                        :value="source2PercentNotInSource1"
                        color="red"
                      >
                        <font color="black">
                          <b>{{source2PercentNotInSource1}}%</b>
                        </font>
                      </v-progress-circular>
                    </center>
                  </v-flex>
                </v-layout>
              </v-flex>
            </v-layout>
          </div>
        </v-flex>
      </v-layout>
      <v-layout
        column
        wrap
      >
        <v-tabs
          icons-and-text
          centered
          grow
          dark
          color="cyan"
        >
          <v-tabs-slider color="red"></v-tabs-slider>
          <v-tab key="match">
            MATCHED ({{source1TotalMatched}})
            <v-icon
              color="white"
              right
            >thumb_up</v-icon>
          </v-tab>
          <v-tab key="double">
            DOUBLE MATCHED ({{$store.state.multipleMatch.length}})
            <v-icon
              color="white"
              right
            >thumb_up</v-icon>
          </v-tab>
          <!-- <v-tab key="nomatch">
            NO MATCH ({{source1TotalNoMatch}})
            <v-icon
              color="white"
              right
            >thumb_down</v-icon>
          </v-tab>
          <v-tab key="ignore">
            IGNORED ({{source1TotalIgnore}})
            <v-icon
              color="white"
              right
            >thumb_down</v-icon>
          </v-tab> -->
          <v-tab key="flagged">
            FLAGGED ({{totalFlagged}})
            <v-icon
              color="white"
              right
            >notification_important</v-icon>
          </v-tab>
          <v-tab-item key="match">
            <template v-if='$store.state.matchedContent != null'>
              <v-text-field
                @input="filterMatched"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
              <v-data-table
                :headers="matchedHeaders"
                :items="$store.state.matchedContent"
                :search="filtersForMatched"
                :custom-filter="customFilter"
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td>{{props.item.source1Name}} <br>&ensp;&ensp;{{props.item.source1Parents.join('->')}}</td>
                  <td>{{props.item.source1Code}}</td>
                  <td>{{props.item.source2Name}} <br>&ensp;&ensp;{{props.item.source2Parents | joinParentsAndReverse}}</td>
                  <td>{{props.item.source2Code}}</td>
                  <td v-if='props.item.matchComments'>{{props.item.matchComments.join(', ')}}</td>
                  <td v-else></td>
                  <td>
                    <v-btn
                      v-if="$store.state.recoStatus == 'Done'"
                      disabled
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakMatch(props.item.source1UUID, props.item.source2UUID)'
                    >
                      <v-icon>undo</v-icon>Break Match
                    </v-btn>
                    <v-btn
                      v-else
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakMatch(props.item.source1UUID, props.item.source2UUID)'
                    >
                      <v-icon>undo</v-icon>Break Match
                    </v-btn>
                  </td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              ></v-progress-linear>
            </template>
          </v-tab-item>
          <v-tab-item key="double">
            <template v-if='$store.state.multipleMatch.length != null'>
              <v-text-field
                v-model="searchMatched"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
              <v-data-table
                :headers="matchedHeaders"
                :items="$store.state.multipleMatch"
                :search="searchMatched"
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td>{{props.item.source1Name}} <br>&ensp;&ensp;{{props.item.source1Parents.join('->')}}</td>
                  <td>{{props.item.source1Code}}</td>
                  <td>{{props.item.source2Name}} <br>&ensp;&ensp;{{props.item.source2Parents | joinParentsAndReverse}}</td>
                  <td>{{props.item.source2Code}}</td>
                  <td></td>
                  <td v-if="props.item.canBreak">
                    <v-btn
                      v-if="$store.state.recoStatus == 'Done'"
                      disabled
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakMatch(props.item.source1UUID, props.item.source2UUID, "doubleMatch")'
                    >
                      <v-icon>undo</v-icon>Break Match
                    </v-btn>
                    <v-btn
                      v-else
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakMatch(props.item.source1UUID, props.item.source2UUID, "doubleMatch")'
                    >
                      <v-icon>undo</v-icon>Break Match
                    </v-btn>
                  </td>
                  <td v-else></td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              ></v-progress-linear>
            </template>
          </v-tab-item>
          <!-- <v-tab-item key="nomatch">
            <template v-if='$store.state.noMatchContent != null'>
              <v-text-field
                v-model="searchNotMatched"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
              <v-data-table
                :headers="noMatchHeaders"
                :items="$store.state.noMatchContent"
                :search="searchNotMatched"
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td>{{props.item.source1Name}}</td>
                  <td>{{props.item.source1Id}}</td>
                  <td>{{props.item.parents.join('->')}}</td>
                  <td>
                    <v-btn
                      v-if="$store.state.recoStatus == 'Done'"
                      disabled
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakNoMatch(props.item.source1UUID, "nomatch")'
                    >
                      <v-icon>cached</v-icon>Break No Match
                    </v-btn>
                    <v-btn
                      v-else
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakNoMatch(props.item.source1UUID, "nomatch")'
                    >
                      <v-icon>cached</v-icon>Break No Match
                    </v-btn>
                  </td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              ></v-progress-linear>
            </template>
          </v-tab-item>
          <v-tab-item key="ignore">
            <template v-if='$store.state.ignoreContent != null'>
              <v-text-field
                v-model="searchIgnore"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
              <v-data-table
                :headers="noMatchHeaders"
                :items="$store.state.ignoreContent"
                :search="searchIgnore"
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td>{{props.item.source1Name}}</td>
                  <td>{{props.item.source1Id}}</td>
                  <td>{{props.item.parents.join('->')}}</td>
                  <td>
                    <v-btn
                      v-if="$store.state.recoStatus == 'Done'"
                      disabled
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakNoMatch(props.item.source1UUID, "ignore")'
                    >
                      <v-icon>cached</v-icon>Break Ignore
                    </v-btn>
                    <v-btn
                      v-else
                      color="error"
                      style='text-transform: none'
                      small
                      @click='breakNoMatch(props.item.source1UUID, "ignore")'
                    >
                      <v-icon>cached</v-icon>Break Ignore
                    </v-btn>
                  </td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              ></v-progress-linear>
            </template>
          </v-tab-item> -->
          <v-tab-item key="flagged">
            <template v-if='$store.state.flagged != null'>
              <v-text-field
                v-model="searchFlagged"
                append-icon="search"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
              <v-data-table
                :headers="flaggedHeaders"
                :items="$store.state.flagged"
                :search="searchFlagged"
                class="elevation-1"
              >
                <template
                  slot="items"
                  slot-scope="props"
                >
                  <td>{{props.item.source1Name}} <br>&ensp;&ensp;{{props.item.source1Parents.join('->')}}</td>
                  <td>{{props.item.source1Code}}</td>
                  <td>{{props.item.source2Name}} <br>&ensp;&ensp;{{props.item.source2Parents | joinParentsAndReverse}}</td>
                  <td>{{props.item.source2Code}}</td>
                  <td>{{props.item.flagComment}}</td>
                  <td>
                    <v-btn
                      v-if="$store.state.recoStatus == 'Done'"
                      disabled
                      color="primary"
                      style='text-transform: none'
                      small
                      @click='acceptFlag(props.item.source1UUID, props.item.source2UUID)'
                    >
                      <v-icon>thumb_up</v-icon>Confirm Match
                    </v-btn>
                    <v-btn
                      v-else
                      color="primary"
                      style='text-transform: none'
                      small
                      @click='acceptFlag(props.item.source1UUID, props.item.source2UUID)'
                    >
                      <v-icon>thumb_up</v-icon>Confirm Match
                    </v-btn>
                    <v-btn
                      v-if="$store.state.recoStatus == 'Done'"
                      disabled
                      color="error"
                      style='text-transform: none'
                      small
                      @click='unFlag(props.item.source1UUID)'
                    >
                      <v-icon>cached</v-icon>Release
                    </v-btn>
                    <v-btn
                      v-else
                      color="error"
                      style='text-transform: none'
                      small
                      @click='unFlag(props.item.source1UUID)'
                    >
                      <v-icon>cached</v-icon>Release
                    </v-btn>
                  </td>
                </template>
              </v-data-table>
            </template>
            <template v-else>
              <v-progress-linear
                :size="70"
                indeterminate
                color="amber"
              />
            </template>
          </v-tab-item>
        </v-tabs>
      </v-layout>
      <v-layout>
        <v-flex
          xs1
          sm4
          md2
          v-if="goNextLevel == 'yes' && !$store.state.scoreSavingProgressData.savingMatches"
        >
          <v-btn
            color="primary"
            round
            @click='levelChanged($store.state.recoLevel+1)'
          >
            <v-icon>forward</v-icon>Proceed to {{nextLevelText}}
          </v-btn>
        </v-flex>
        <v-flex
          xs1
          sm4
          md2
          v-if="lastLevelDone == 'yes'"
        >
          <v-btn
            color="primary"
            round
            @click='$router.push({name:"FacilityRecoStatus"})'
          >
            <v-icon>dashboard</v-icon>Reconciliation Status
          </v-btn>
        </v-flex>
      </v-layout>
    </v-container>
  </v-container>
</template>
<script>
import axios from 'axios'
import LiquorTree from 'liquor-tree'
import { scoresMixin } from '../mixins/scoresMixin'
import { generalMixin } from '../mixins/generalMixin'
import { eventBus } from '../main'
import ReconciliationExport from './ReconciliationExport'

const backendServer = process.env.BACKEND_SERVER

export default {
  mixins: [scoresMixin, generalMixin],
  data () {
    return {
      flagCommentDialog: false,
      flagComment: '',
      helpDialog: false,
      type: '',
      source2Id: '',
      source2Name: '',
      sort_arrow: 'up',
      pagination: { sortBy: 'score' },
      recoLevel: 0,
      filtersForSrc1Unmatched: {
        byParent: '',
        bySrc1Unmatched: ''
      },
      filtersForMatched: {
        byParentSrc1: '',
        byMatched: ''
      },
      searchUnmatchedSource2: '',
      searchUnmatchedSource1: '',
      searchPotential: '',
      searchMatched: '',
      searchNotMatched: '',
      searchIgnore: '',
      searchFlagged: '',
      potentialMatches: [],
      showAllPotential: false,
      alertText: '',
      alertTitle: '',
      alert: false,
      source1Parents: {},
      source1Filter: { text: '', level: '' },
      source1TreeUpdate: 0,
      selectedSource1: {},
      selectedSource1Name: null,
      selectedSource1Id: null,
      selectedSource1UUID: null,
      selectedSource2UUID: null,
      selectedSource1Lat: null,
      selectedSource1Long: null,
      selectedSource1Code: null,
      selectedSource1Parents: [],
      dialog: false,
      dialogWidth: '',
      source1UnmatchedHeaders: [{ text: 'Name', value: 'name' }, { text: 'Code', value: 'code' }],
      noMatchHeaders: [
        { text: `${this.$store.state.activePair.source1.name.toUpperCase()} Location`, value: 'source1Name' },
        { text: `${this.$store.state.activePair.source1.name.toUpperCase()} Code`, value: 'source1Code' },
        { text: 'Parents', value: 'parents' }
      ],
      flaggedHeaders: [
        { text: `${this.$store.state.activePair.source1.name.toUpperCase()} Location`, value: 'source1Name' },
        { text: `${this.$store.state.activePair.source1.name.toUpperCase()} Code`, value: 'source1Code' },
        { text: `${this.$store.state.activePair.source2.name.toUpperCase()} Location`, value: 'source2Name' },
        { text: `${this.$store.state.activePair.source2.name.toUpperCase()} Code`, value: 'source2Code' },
        { text: 'Comment', value: 'flagComment' }
      ]
    }
  },
  filters: {
    removeCountry (parents) {
      var parentsCopy = parents.slice(0)
      parentsCopy.splice(parentsCopy.length - 1, 1)
      return parentsCopy
    },
    joinParents (parents) {
      return parents.join('->')
    },
    joinParentsAndReverse (parents) {
      return [...parents].reverse().join('->')
    }
  },
  methods: {
    changeSort (column) {
      if (this.pagination.sortBy === column) {
        this.pagination.descending = !this.pagination.descending
      } else {
        this.pagination.sortBy = column
        this.pagination.descending = false
      }
      if (this.pagination.descending) {
        this.sort_arrow = 'down'
      } else {
        this.sort_arrow = 'up'
      }
    },
    addListener () {
      const setListener = () => {
        if (this.$refs && this.$refs.source1Tree) {
          this.$refs.source1Tree.$on('node:selected', node => {
            this.source1Filter.text = node.data.text
            let level = 1
            while (node.parent) {
              node = node.parent
              level++
            }
            this.source1Filter.level = level
          })
        } else {
          setTimeout(function () {
            setListener()
          }, 500)
        }
      }
      setListener()
    },
    levelChanged (level) {
      if (this.$store.state.recoLevel === level) {
        return
      }
      this.$store.state.recoLevel = level
      this.getScores()
      if (
        this.$store.state.recoLevel === this.$store.state.totalSource1Levels
      ) {
        this.dialogWidth = '1440px'
      } else {
        this.dialogWidth = '1190px'
      }
    },
    getPotentialMatch (id) {
      this.potentialMatches = []
      this.showAllPotential = false
      for (let scoreResult of this.$store.state.scoreResults) {
        if (scoreResult.source1.id === id) {
          this.selectedSource1 = scoreResult.source1
          this.selectedSource1Name = scoreResult.source1.name
          this.selectedSource1Parents = scoreResult.source1.parents
          this.selectedSource1Lat = scoreResult.source1.lat
          this.selectedSource1Long = scoreResult.source1.long
          this.selectedSource1Code = scoreResult.source1.code
          this.selectedSource1Id = scoreResult.source1.id
          this.selectedSource1UUID = scoreResult.source1.uuid
          for (let score in scoreResult.potentialMatches) {
            for (let j in scoreResult.potentialMatches[score]) {
              let potentials = scoreResult.potentialMatches[score][j]
              var matched = this.$store.state.matchedContent.find(matched => {
                return matched.source2Id === potentials.id
              })
              var flagged = this.$store.state.flagged.find(flagged => {
                return flagged.source2Id === potentials.id
              })
              if (matched) {
                continue
              }
              if (flagged) {
                continue
              }
              this.potentialMatches.push({
                score: score,
                name: potentials.name,
                id: potentials.id,
                code: potentials.code,
                uuid: potentials.uuid,
                lat: potentials.lat,
                long: potentials.long,
                geoDistance: potentials.geoDistance,
                parents: potentials.parents,
                mappedParentName: potentials.mappedParentName
              })
            }
          }
        }
      }
      this.dialog = true
    },
    potentialMatchComment (potentialMatch) {
      let comment = ''
      // check if ID different
      if (this.$store.state.recoLevel === this.$store.state.totalSource1Levels) {
        if (potentialMatch.code !== this.selectedSource1.code) {
          if (comment) {
            comment += ', '
          }
          comment += 'Code differ'
        }
      }

      // check if names are different
      if (potentialMatch.name.toLowerCase() !== this.selectedSource1.name.toLowerCase()) {
        if (comment) {
          comment += ', '
        }
        comment += 'Names differ'
      }

      return comment
    },
    match (type, source2Id, source2Name, source2uuid, mappedParentName) {
      this.matchType = type
      this.source2Id = source2Id
      this.source2Name = source2Name
      this.selectedSource2UUID = source2uuid
      this.mappedParentName = mappedParentName
      if (source2uuid === null) {
        this.alert = true
        this.alertTitle = 'Information'
        this.alertText = `Select ${this.$store.state.activePair.source2.name.toUpperCase()} Location to match against ${this.$store.state.activePair.source1.name.toUpperCase()} Location`
        return
      }
      if (type === 'flag') {
        this.flagCommentDialog = true
      } else {
        this.saveMatch()
      }
    },
    flag () {
      this.flagCommentDialog = false
      this.$store.state.progressTitle = 'Saving flag'
      this.$store.state.dynamicProgress = true
      let formData = new FormData()
      formData.append('source1Id', this.selectedSource1UUID)
      formData.append('source2Id', this.source2Id)
      formData.append('flagComment', this.flagComment)
      formData.append('source1DB', this.getSource1())
      axios
        .post(backendServer + '/flag', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        .then(response => {
          this.$store.state.dynamicProgress = false
          // remove from Source 2 Unmatched
          let source2Parents = null
          let source2UUID
          let source2Code
          for (let k in this.$store.state.source2UnMatched) {
            if (this.$store.state.source2UnMatched[k].id === this.source2Id) {
              source2Parents = this.$store.state.source2UnMatched[k].parents
              source2UUID = this.$store.state.source2UnMatched[k].uuid
              source2Code = this.$store.state.source2UnMatched[k].code
              this.$store.state.source2UnMatched.splice(k, 1)
            }
          }

          // Add from a list of flagged and remove from list of Source 1 unMatched
          for (let k in this.$store.state.source1UnMatched) {
            if (this.$store.state.source1UnMatched[k].uuid === this.selectedSource1UUID) {
              ++this.$store.state.totalAllFlagged
              this.$store.state.flagged.push({
                source1Name: this.selectedSource1Name,
                source1Id: this.selectedSource1Id,
                source1Code: this.$store.state.source1UnMatched[k].code,
                source1UUID: this.selectedSource1UUID,
                source1Parents: this.$store.state.source1UnMatched[k].parents,
                source2Name: this.source2Name,
                source2Id: this.source2Id,
                source2Code: source2Code,
                source2UUID: source2UUID,
                mappedParentName: this.mappedParentName,
                source2Parents: source2Parents,
                flagComment: this.flagComment
              })
              this.$store.state.source1UnMatched.splice(k, 1)
            }
          }
          this.flagComment = ''
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource1Name = null
          this.dialog = false
        })
        .catch(err => {
          this.flagComment = ''
          this.$store.state.dynamicProgress = false
          this.alert = true
          this.alertTitle = 'Error'
          this.alertText = err.response.data.error
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource1Name = null
          this.dialog = false
        })
    },
    saveMatch (type) {
      this.flagCommentDialog = false
      this.$store.state.progressTitle = 'Saving match'
      this.$store.state.dynamicProgress = true
      let formData = new FormData()
      formData.append('source1Id', this.selectedSource1UUID)
      formData.append('source2Id', this.selectedSource2UUID)
      formData.append('source1DB', this.getSource1())
      axios
        .post(backendServer + '/match', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        .then(response => {
          this.$store.state.dynamicProgress = false
          // remove from Source 2 Unmatched
          let source2Parents = null
          let source2Code
          for (let k in this.$store.state.source2UnMatched) {
            if (this.$store.state.source2UnMatched[k].uuid === this.selectedSource2UUID) {
              source2Parents = this.$store.state.source2UnMatched[k].parents
              source2Code = this.$store.state.source2UnMatched[k].code
              this.$store.state.source2UnMatched.splice(k, 1)
            }
          }

          // Add from a list of Source 1 Matched and remove from list of Source 1 unMatched
          for (let k in this.$store.state.source1UnMatched) {
            if (this.$store.state.source1UnMatched[k].uuid === this.selectedSource1UUID) {
              ++this.$store.state.totalAllMapped
              this.$store.state.matchedContent.push({
                source1Name: this.selectedSource1Name,
                source1Id: this.selectedSource1Id,
                source1Code: this.$store.state.source1UnMatched[k].code,
                source1UUID: this.selectedSource1UUID,
                source1Parents: this.$store.state.source1UnMatched[k].parents,
                source2Name: this.source2Name,
                source2Id: this.source2Id,
                source2Code: source2Code,
                source2UUID: this.selectedSource2UUID,
                mappedParentName: this.mappedParentName,
                source2Parents: source2Parents,
                matchComments: response.data.matchComments
              })
              this.$store.state.source1UnMatched.splice(k, 1)
            }
          }
          if (type === 'flag') {
            for (let k in this.$store.state.flagged) {
              if (this.$store.state.flagged[k].source1UUID === this.selectedSource1UUID) {
                this.$store.state.matchedContent.push({
                  source1Name: this.$store.state.flagged[k].source1Name,
                  source1Id: this.$store.state.flagged[k].source1Id,
                  source1Code: this.$store.state.flagged[k].source1Code,
                  source1UUID: this.$store.state.flagged[k].source1UUID,
                  source1Parents: this.$store.state.flagged[k].source1Parents,
                  source2Name: this.$store.state.flagged[k].source2Name,
                  source2Id: this.$store.state.flagged[k].source2Id,
                  source2Code: this.$store.state.flagged[k].source2Code,
                  source2UUID: this.selectedSource2UUID,
                  source2IdHierarchy: this.$store.state.flagged[k].source2IdHierarchy,
                  mappedParentName: this.$store.state.flagged[k].mappedParentName,
                  source2Parents: this.$store.state.flagged[k].source2Parents
                })
                this.$store.state.flagged.splice(k, 1)
                ++this.$store.state.totalAllMapped
                --this.$store.state.totalAllFlagged
              }
            }
          }
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource2UUID = null
          this.selectedSource1Name = null
          this.dialog = false
        })
        .catch(err => {
          this.$store.state.dynamicProgress = false
          this.alert = true
          this.alertTitle = 'Error'
          this.alertText = err.response.data.error
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource2UUID = null
          this.selectedSource1Name = null
          this.dialog = false
        })
    },
    acceptFlag (source1UUID, source2UUID) {
      this.selectedSource1UUID = source1UUID
      this.selectedSource2UUID = source2UUID
      this.saveMatch('flag')
    },
    breakMatch (source1UUID, source2UUID, matchType) {
      this.$store.state.progressTitle = 'Breaking match'
      this.$store.state.dynamicProgress = true
      let formData = new FormData()
      formData.append('source1Id', source1UUID)
      formData.append('source2Id', source2UUID)
      axios
        .post(backendServer + '/breakMatch/' + this.getSource1(), formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
        )
        .then(data => {
          this.$store.state.dynamicProgress = false
          if (matchType === 'doubleMatch') {
            return this.getScores()
          }
          this.alert = true
          this.alertTitle = 'Information'
          this.alertText = 'Scores for this Location may not be available unless you recalculate scores'
          for (let k in this.$store.state.matchedContent) {
            if (this.$store.state.matchedContent[k].source1UUID === source1UUID) {
              this.$store.state.source1UnMatched.push({
                name: this.$store.state.matchedContent[k].source1Name,
                id: this.$store.state.matchedContent[k].source1Id,
                code: this.$store.state.matchedContent[k].source1Code,
                uuid: this.$store.state.matchedContent[k].source1UUID,
                parents: this.$store.state.matchedContent[k].source1Parents
              })
              this.$store.state.source2UnMatched.push({
                name: this.$store.state.matchedContent[k].source2Name,
                id: this.$store.state.matchedContent[k].source2Id,
                code: this.$store.state.matchedContent[k].source2Code,
                uuid: this.$store.state.matchedContent[k].source2UUID,
                mappedParentName: this.$store.state.matchedContent[k].mappedParentName,
                parents: this.$store.state.matchedContent[k].source2Parents
              })
              this.$store.state.matchedContent.splice(k, 1)
              --this.$store.state.totalAllMapped
            }
          }
        })
        .catch(err => {
          this.$store.state.dynamicProgress = false
          this.alert = true
          this.alertTitle = 'Error'
          this.alertText = err.response.data.error
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource1Name = null
          this.dialog = false
          console.log(err)
        })
    },
    unFlag (source1UUID) {
      this.$store.state.progressTitle = 'Unflagging match'
      this.$store.state.dynamicProgress = true
      let formData = new FormData()
      formData.append('source1Id', source1UUID)
      formData.append('source1DB', this.getSource1())
      axios.post(backendServer + '/unflag', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then(data => {
        this.$store.state.dynamicProgress = false
        this.alert = true
        this.alertTitle = 'Information'
        this.alertText = 'Scores for this Location may not be available unless you recalculate scores'
        for (let k in this.$store.state.flagged) {
          if (this.$store.state.flagged[k].source1UUID === source1UUID) {
            this.$store.state.source1UnMatched.push({
              name: this.$store.state.flagged[k].source1Name,
              id: this.$store.state.flagged[k].source1Id,
              code: this.$store.state.flagged[k].source1Code,
              uuid: this.$store.state.flagged[k].source1UUID,
              parents: this.$store.state.flagged[k].source1Parents
            })
            this.$store.state.source2UnMatched.push({
              name: this.$store.state.flagged[k].source2Name,
              id: this.$store.state.flagged[k].source2Id,
              code: this.$store.state.flagged[k].source2Code,
              uuid: this.$store.state.flagged[k].source2UUID,
              mappedParentName: this.$store.state.flagged[k].mappedParentName,
              parents: this.$store.state.flagged[k].source2Parents
            })
            this.$store.state.flagged.splice(k, 1)
            --this.$store.state.totalAllFlagged
          }
        }
      }).catch(err => {
        this.$store.state.dynamicProgress = false
        this.alert = true
        this.alertTitle = 'Error'
        this.alertText = err.response.data.error
        this.selectedSource1Id = null
        this.selectedSource1UUID = null
        this.selectedSource1Name = null
        this.dialog = false
        console.log(err)
      })
    },
    breakNoMatch (source1UUID, type) {
      this.$store.state.progressTitle = 'Breaking no match'
      this.$store.state.dynamicProgress = true
      let formData = new FormData()
      formData.append('source1Id', source1UUID)
      formData.append('recoLevel', this.$store.state.recoLevel)
      formData.append('totalLevels', this.$store.state.totalSource1Levels)
      let userID = this.$store.state.activePair.userID._id
      axios
        .post(backendServer + '/breakNoMatch/' + type + '/' + this.getSource1() + '/' + this.getSource2() + '/' + userID, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
        )
        .then(data => {
          this.$store.state.dynamicProgress = false
          this.alert = true
          this.alertTitle = 'Information'
          this.alertText =
            'Scores for this Location may not be available unless you recalculate scores'
          if (type === 'nomatch') {
            for (let k in this.$store.state.noMatchContent) {
              if (this.$store.state.noMatchContent[k].source1UUID === source1UUID) {
                this.$store.state.source1UnMatched.push({
                  name: this.$store.state.noMatchContent[k].source1Name,
                  id: this.$store.state.noMatchContent[k].source1Id,
                  code: this.$store.state.noMatchContent[k].source1Code,
                  uuid: this.$store.state.noMatchContent[k].source1UUID,
                  parents: this.$store.state.noMatchContent[k].parents
                })
                this.$store.state.noMatchContent.splice(k, 1)
                --this.$store.state.totalAllNoMatch
              }
            }
          } else if (type === 'ignore') {
            for (let k in this.$store.state.ignoreContent) {
              if (this.$store.state.ignoreContent[k].source1UUID === source1UUID) {
                this.$store.state.source1UnMatched.push({
                  name: this.$store.state.ignoreContent[k].source1Name,
                  id: this.$store.state.ignoreContent[k].source1Id,
                  code: this.$store.state.ignoreContent[k].source1Code,
                  uuid: this.$store.state.ignoreContent[k].source1UUID,
                  parents: this.$store.state.ignoreContent[k].parents
                })
                this.$store.state.ignoreContent.splice(k, 1)
                --this.$store.state.totalAllIgnore
              }
            }
          }
        })
        .catch(err => {
          this.$store.state.dynamicProgress = false
          this.alert = true
          this.alertTitle = 'Error'
          this.alertText = err.response.data.error
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource1Name = null
          this.dialog = false
          console.log(err)
        })
    },
    noMatch (type) {
      this.$store.state.progressTitle = 'Saving as no match'
      this.$store.state.dynamicProgress = true
      let userID = this.$store.state.activePair.userID._id
      let sourcesOwner = this.getDatasourceOwner()
      let source1Owner = sourcesOwner.source1Owner
      let source2Owner = sourcesOwner.source2Owner
      let formData = new FormData()
      formData.append('source1Id', this.selectedSource1UUID)
      formData.append('recoLevel', this.$store.state.recoLevel)
      formData.append('totalLevels', this.$store.state.totalSource1Levels)

      axios
        .post(backendServer + `/noMatch/${type}/${this.getSource1()}/${this.getSource2()}/${source1Owner}/${source2Owner}/${userID}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }).then(() => {
          this.$store.state.dynamicProgress = false
          // remove from Source 1 Unmatched
          if (type === 'nomatch') {
            for (let k in this.$store.state.source1UnMatched) {
              if (
                this.$store.state.source1UnMatched[k].id ===
                this.selectedSource1Id
              ) {
                this.$store.state.noMatchContent.push({
                  source1Name: this.selectedSource1Name,
                  source1Id: this.selectedSource1Id,
                  source1UUID: this.selectedSource1UUID,
                  parents: this.$store.state.source1UnMatched[k].parents
                })
                ++this.$store.state.totalAllNoMatch
                this.$store.state.source1UnMatched.splice(k, 1)
              }
            }
          } else if (type === 'ignore') {
            for (let k in this.$store.state.source1UnMatched) {
              if (this.$store.state.source1UnMatched[k].id === this.selectedSource1Id) {
                this.$store.state.ignoreContent.push({
                  source1Name: this.selectedSource1Name,
                  source1Id: this.selectedSource1Id,
                  source1UUID: this.selectedSource1UUID,
                  parents: this.$store.state.source1UnMatched[k].parents
                })
                ++this.$store.state.totalAllIgnore
                this.$store.state.source1UnMatched.splice(k, 1)
              }
            }
          }
          this.dialog = false
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource1Name = null
        })
        .catch(err => {
          this.$store.state.dynamicProgress = false
          this.alert = true
          this.alertTitle = 'Error'
          this.alertText = err.response.data.error
          this.dialog = false
          this.selectedSource1Id = null
          this.selectedSource1UUID = null
          this.selectedSource1Name = null
        })
    },
    back () {
      this.searchPotential = ''
      this.dialog = false
    },
    customFilter (items, filters, filter, headers) {
      // Init the filter class.
      const cf = new this.$MultiFilters(items, filters, filter, headers)

      cf.registerFilter('bySrc1Unmatched', function (searchWord, items) {
        if (!searchWord) return items

        return items.filter(item => {
          return item.name.toLowerCase().includes(searchWord.toLowerCase())
        }, searchWord)
      })

      cf.registerFilter('byMatched', function (searchWord, items) {
        if (!searchWord) return items

        return items.filter(item => {
          return item.source1Name.toLowerCase().includes(searchWord.toLowerCase())
        }, searchWord)
      })

      cf.registerFilter('byParent', function (byParent, items) {
        if (!byParent) return items
        return items.filter(item => {
          return item.parents && item.parents[0] && item.parents[0].toLowerCase() === byParent.toLowerCase()
        }, byParent)
      })

      cf.registerFilter('byParentSrc1', function (byParentSrc1, items) {
        if (!byParentSrc1) return items
        return items.filter(item => {
          return item.source1Parents && item.source1Parents[0] && item.source1Parents[0].toLowerCase() === byParentSrc1.toLowerCase()
        }, byParentSrc1)
      })
      return cf.runFilters()
    },
    filterSrc1Unmatched (val) {
      this.filtersForSrc1Unmatched = this.$MultiFilters.updateFilters(this.filtersForSrc1Unmatched, {bySrc1Unmatched: val})
    },
    filterMatched (val) {
      this.filtersForMatched = this.$MultiFilters.updateFilters(this.filtersForMatched, {byMatched: val})
    },
    filterByParent (val) {
      this.filtersForSrc1Unmatched = this.$MultiFilters.updateFilters(this.filtersForSrc1Unmatched, {byParent: val})
      this.filtersForMatched = this.$MultiFilters.updateFilters(this.filtersForMatched, {byParentSrc1: val})
    }
  },
  computed: {
    nextLevelText: {
      get: function () {
        return this.translateDataHeader('source1', this.$store.state.recoLevel)
      },
      set: function (newVal) { }
    },
    currentLevelText: {
      get: function () {
        return this.translateDataHeader(
          'source1',
          this.$store.state.recoLevel - 1
        )
      },
      set: function (newVal) { }
    },
    matchedHeaders () {
      let header = [
        { text: `${this.$store.state.activePair.source1.name.toUpperCase()} Location`, value: 'source1Name' },
        { text: `${this.$store.state.activePair.source1.name.toUpperCase()} Code`, value: 'source1Code' },
        { text: `${this.$store.state.activePair.source2.name.toUpperCase()} Location`, value: 'source2Name' },
        { text: `${this.$store.state.activePair.source2.name.toUpperCase()} Code`, value: 'source2Code' },
        { text: 'Match Comment', value: 'matchComments' }
      ]
      return header
    },
    source1GridHeaders () {
      let header = [{ text: 'Name', value: 'name' }]
      if (this.$store.state.source1UnMatched.length > 0) {
        for (
          let i = this.$store.state.source1UnMatched[0].parents.length;
          i > 0;
          i--
        ) {
          header.push({ text: 'Level ' + i, value: 'level' + (i + 1) })
        }
      }
      header.splice(1, 1)
      header.push({ text: 'Code', value: 'code' })
      return header
    },
    potentialHeaders () {
      var results = []
      results.push(
        { sortable: false },
        { text: `${this.$store.state.activePair.source2.name.toUpperCase()} Location`, value: 'name', sortable: false },
        { text: 'Code', value: 'code', sortable: false },
        { text: 'Parent', value: 'source2Parent', sortable: false }
      )
      results.push({ text: 'Score', value: 'score' })
      return results
    },
    potentialAvailable () {
      return (
        this.$store.state.source2UnMatched !== null &&
        this.$store.state.source2UnMatched.length > this.potentialMatches.length
      )
    },
    allPotentialMatches () {
      if (
        this.$store.state.source2UnMatched !== null &&
        this.$store.state.source2UnMatched.length >
        this.potentialMatches.length &&
        this.showAllPotential
      ) {
        let results = []
        for (let addIt of this.$store.state.source2UnMatched) {
          let matched = this.potentialMatches.find(matched => {
            return matched.id === addIt.id
          })
          if (!matched) {
            addIt.score = 'N/A'
            results.push(addIt)
          }
        }
        return this.potentialMatches.concat(results)
      } else {
        return this.potentialMatches
      }
    },
    source1Tree () {
      this.addListener()
      let activeDtSrc1 = this.$store.state.dataSources.find((dtsrc) => {
        return dtsrc._id === this.$store.state.activePair.source1.id
      })
      if (activeDtSrc1.source === 'vims') {
        return
      }
      const createTree = (current, results) => {
        for (let name in current) {
          let add = { text: name }
          add.children = []
          createTree(current[name], add.children)
          if (add.children.length === 0) {
            delete add.children
          }
          results.push(add)
        }
      }
      let results = []
      if (
        Object.keys(this.$store.state.source1Parents).length === 1 &&
        Object.keys(this.$store.state.source1Parents)[0] === 'null'
      ) {
        return results
      }
      createTree(this.$store.state.source1Parents, results)
      // This is needed because the tree doesn't show up on the initial page load without it
      this.source1TreeUpdate++
      return results
    },
    source1Grid () {
      if (
        this.$store.state.source1UnMatched.length > 0 &&
        this.source1Filter.level !== ''
      ) {
        let parentIdx =
          this.$store.state.source1UnMatched[0].parents.length -
          this.source1Filter.level
        return this.$store.state.source1UnMatched.filter(
          location => location.parents[parentIdx] === this.source1Filter.text
        )
      }
      return this.$store.state.source1UnMatched
    },
    goNextLevel () {
      if (
        this.$store.state.recoLevel < this.$store.state.totalSource1Levels &&
        this.$store.state.source1UnMatched !== null &&
        this.$store.state.source1UnMatched.length === 0 &&
        this.$store.state.flagged !== null &&
        this.$store.state.flagged.length === 0 &&
        this.$store.state.matchedContent !== null &&
        this.$store.state.matchedContent.length !== 0
      ) {
        return 'yes'
      } else {
        return 'no'
      }
    },
    lastLevelDone () {
      if (
        this.$store.state.recoLevel === this.$store.state.totalSource1Levels &&
        this.$store.state.source1UnMatched !== null &&
        this.$store.state.source1UnMatched.length === 0 &&
        this.$store.state.flagged !== null &&
        this.$store.state.flagged.length === 0
      ) {
        return 'yes'
      } else {
        return 'no'
      }
    },
    source1TotalRecords () {
      if (this.$store.state.scoreResults) {
        return this.$store.state.scoreResults.length
      } else {
        return 0
      }
    },
    source1TotalMatched () {
      if (this.$store.state.matchedContent) {
        return this.$store.state.matchedContent.length
      } else {
        return 0
      }
    },
    source1PercentMatched () {
      if (this.source1TotalRecords === 0) {
        return 0
      } else {
        return parseFloat(
          ((this.source1TotalMatched * 100) / this.source1TotalRecords).toFixed(
            1
          )
        )
      }
    },
    source1TotalUnMatched () {
      return this.source1TotalRecords - this.source1TotalMatched
    },
    source1PercentUnMatched () {
      if (this.source1TotalRecords === 0) {
        return 0
      } else {
        return parseFloat(
          (
            (this.source1TotalUnMatched * 100) /
            this.source1TotalRecords
          ).toFixed(1)
        )
      }
    },
    totalFlagged () {
      if (this.$store.state.flagged) {
        return this.$store.state.flagged.length
      } else {
        return 0
      }
    },
    source1PercentFlagged () {
      if (this.$store.state.scoreResults.length === 0) {
        return 0
      } else if (this.$store.state.flagged) {
        return parseFloat(
          (
            (this.$store.state.flagged.length * 100) /
            this.$store.state.scoreResults.length
          ).toFixed(1)
        )
      } else {
        return 0
      }
    },
    source1TotalNoMatch () {
      if (this.$store.state.noMatchContent) {
        return this.$store.state.noMatchContent.length
      } else {
        return 0
      }
    },
    source1TotalIgnore () {
      if (this.$store.state.ignoreContent) {
        return this.$store.state.ignoreContent.length
      } else {
        return 0
      }
    },
    source1PercentNoMatch () {
      if (this.$store.state.scoreResults.length === 0) {
        return 0
      } else if (this.$store.state.noMatchContent) {
        return parseFloat(
          (
            (this.$store.state.noMatchContent.length * 100) /
            this.$store.state.scoreResults.length
          ).toFixed(1)
        )
      } else {
        return 0
      }
    },
    source1PercentIgnore () {
      if (this.$store.state.scoreResults.length === 0) {
        return 0
      } else if (this.$store.state.ignoreContent) {
        return parseFloat(
          (
            (this.$store.state.ignoreContent.length * 100) /
            this.$store.state.scoreResults.length
          ).toFixed(1)
        )
      } else {
        return 0
      }
    },
    source2TotalRecords () {
      if (this.$store.state.source2TotalRecords) {
        return this.$store.state.source2TotalRecords
      } else {
        return 0
      }
    },
    source2TotalUnmatched () {
      if (this.source2TotalRecords > 0 && this.$store.state.matchedContent) {
        return (
          parseInt(this.source2TotalRecords) -
          parseInt(this.$store.state.matchedContent.length)
        )
      } else {
        return 0
      }
    },
    source2PercentUnmatched () {
      if (this.$store.state.source2TotalRecords === 0) {
        return 0
      } else {
        return parseFloat(
          (
            (this.source2TotalUnmatched * 100) /
            this.$store.state.source2TotalRecords
          ).toFixed(1)
        )
      }
    },
    source2PercentFlagged () {
      if (this.$store.state.source2TotalRecords === 0) {
        return 0
      } else if (this.$store.state.flagged) {
        return parseFloat(
          (
            (this.$store.state.flagged.length * 100) /
            this.$store.state.source2TotalRecords
          ).toFixed(1)
        )
      } else {
        return 0
      }
    },
    source2TotalMatched () {
      return this.source1TotalMatched
    },
    source2PercentMatched () {
      if (this.$store.state.source2TotalRecords === 0) {
        return 0
      } else {
        return parseFloat(
          (
            (this.source2TotalMatched * 100) /
            this.$store.state.source2TotalRecords
          ).toFixed(1)
        )
      }
    },
    source2NotInSource1 () {
      var missing = this.source2TotalRecords - this.source1TotalRecords
      if (missing < 0) {
        return 0
      } else {
        return missing
      }
    },
    source2PercentNotInSource1 () {
      if (this.source2NotInSource1 === 0) {
        return 0
      }
      var percent = parseFloat(
        ((this.source2NotInSource1 * 100) / this.source2TotalRecords).toFixed(1)
      )
      return parseFloat(percent)
    }
  },
  created () {
    if (this.$store.state.recalculateScores) {
      this.$store.state.recalculateScores = false
      this.getScores()
    }
    eventBus.$on('changeCSVHeaderNames', () => {
      let levelName = this.translateDataHeader(
        'source1',
        this.$store.state.recoLevel
      )
      this.nextLevelText = levelName
      this.currentLevelText = levelName
    })
    this.addListener()
    if (this.$store.state.recoLevel === this.$store.state.totalSource1Levels) {
      this.dialogWidth = 'auto'
    } else {
      this.dialogWidth = '1190px'
    }
  },
  components: {
    'liquor-tree': LiquorTree,
    'appRecoExport': ReconciliationExport
  }
}
</script>
<style>
</style>
