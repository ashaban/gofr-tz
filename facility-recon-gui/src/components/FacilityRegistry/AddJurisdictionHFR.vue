<template>
  <v-container fluid>
    <v-dialog
      v-model="approve"
      width="630px"
    >
      <v-toolbar
        color="error"
        dark
      >
        <v-toolbar-title>
          Accepting HFR Admin Area
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          icon
          dark
          @click.native="approve = false"
        >
          <v-icon>close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card>
        <v-card-text>
          Selected Parent: {{activeJurisdiction.text}}
          <liquor-tree
            @node:selected="selectedJurisdiction"
            v-if="jurisdictionHierarchy.length > 0"
            :data="jurisdictionHierarchy"
            :options="treeOpts"
            :filter="searchJurisdiction"
            ref="jurisdictionHierarchy"
          />
          <v-progress-linear
            v-else
            indeterminate
            color="red"
            class="mb-0"
          ></v-progress-linear>
          Parent In HFR {{acceptingItem.parent}}
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            @click.native="approve = false"
          >Cancel</v-btn>
          <v-spacer></v-spacer>
          <v-btn
            :disabled='!canAdd'
            color="error"
            @click="addFromHFR"
          >Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-card
      flat
    >
      <v-card-title primary-title>
        <v-layout
          row
          wrap
        >
          <v-flex>
            HFR Admin Area Missing Inside Openinfoman
          </v-flex>
          <v-spacer></v-spacer>
          <v-flex>
            <v-text-field
              v-model="searchJurisdictions"
              append-icon="search"
              label="Search Facility"
              single-line
              hide-details
            ></v-text-field>
          </v-flex>
        </v-layout>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :loading="loadingJurisdictions"
          :headers="buildingsHeaders"
          :items="buildings"
          :search="searchJurisdictions"
          class="elevation-1"
        >
          <template
            slot="items"
            slot-scope="props"
          >
            <td>
              <v-tooltip
                top
              >
                <v-btn
                  icon
                  color="success"
                  slot="activator"
                  @click="accept(props.item)"
                >
                  <v-icon>check_circle</v-icon>
                </v-btn>
                <span>Accept</span>
              </v-tooltip>
            </td>
            <td>{{props.item.name}}</td>
            <td>{{props.item.code}}</td>
            <td>{{props.item.parent}}</td>
            <td>{{props.item.status.text}}</td>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script>
import LiquorTree from 'liquor-tree'
import axios from 'axios'
import {
  tasksVerification
} from '@/modules/tasksVerification'
import { generalMixin } from '../../mixins/generalMixin'
const backendServer = process.env.BACKEND_SERVER
export default {
  mixins: [generalMixin],
  data () {
    return {
      loadingTree: false,
      treeOpts: {
        fetchData (node) {
          return axios.get(backendServer + '/FR/getTree', {
            params: {
              includeBuilding: false,
              sourceLimitOrgId: node.id,
              recursive: false
            }
          }).then((hierarchy) => {
            return hierarchy.data
          })
        }
      },
      jurisdictionHierarchy: [],
      activeJurisdiction: {},
      searchJurisdiction: '',
      approve: false,
      acceptingItem: {},
      searchJurisdictions: '',
      loadingJurisdictions: false,
      facilities: [],
      buildings: [],
      buildingsHeaders: [
        { sortable: false },
        { text: 'Name', value: 'name' },
        { text: 'HFR Code', value: 'code' },
        { text: 'Parent', value: 'parent' },
        { text: 'Status', value: 'status' }
      ],
      tasksVerification: tasksVerification
    }
  },
  computed: {
    canAdd () {
      if (!this.activeJurisdiction.id) {
        return false
      }
      return true
    }
  },
  methods: {
    canEditBuilding (item) {
      if (this.tasksVerification.canEdit('FacilitiesReport') || this.tasksVerification.canAdd('RequestUpdateBuildingDetails')) {
        return true
      }
      return false
    },
    canChangeRequestStatus (item, actionName) {
      if ((this.requestType === 'update' && this.tasksVerification.canApprove('FacilitiesUpdateRequestsReport')) ||
        (this.requestType === 'add' && this.tasksVerification.canApprove('NewFacilitiesRequestsReport')) ||
        (this.requestType === 'update' && this.tasksVerification.canReject('FacilitiesUpdateRequestsReport')) ||
        (this.requestType === 'add' && this.tasksVerification.canReject('NewFacilitiesRequestsReport'))) {
        return true
      } else {
        return false
      }
    },
    selectedJurisdiction (node) {
      this.activeJurisdiction = node
    },
    getMissingFromHFR () {
      this.facilities = []
      this.buildings = []
      this.loadingJurisdictions = true
      axios.get(backendServer + '/FR/getJurisdictionsMissingFromHFR', {
        params: {
          action: 'request',
          requestCategory: 'requestsList'
        }
      }).then((response) => {
        this.loadingJurisdictions = false
        this.buildings = response.data
      }).catch((err) => {
        this.loadingJurisdictions = false
        console.log(err)
      })
    },
    accept (item) {
      this.activeJurisdiction = {}
      this.acceptingItem = item
      this.approve = true
    },
    addFromHFR () {
      this.$store.state.dynamicProgress = true
      this.$store.state.progressTitle = 'Saving ...'
      let formData = new FormData()
      formData.append('id', this.acceptingItem.id)
      formData.append('parent', this.activeJurisdiction.id)
      formData.append('parentLevel', this.activeJurisdiction.data.level)
      axios.post(backendServer + '/FR/addFromHFR', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.$store.state.dynamicProgress = false
        this.$store.state.alert.show = true
        this.$store.state.alert.width = '600px'
        this.$store.state.alert.msg = 'Facility added successfully!'
        this.$store.state.alert.type = 'success'
        // increment component key to force component reload
        this.$store.state.baseRouterViewKey += 1
      }).catch((err) => {
        this.$store.state.dynamicProgress = false
        this.$store.state.alert.show = true
        this.$store.state.alert.width = '600px'
        this.$store.state.alert.msg = 'Failed to add Facility!'
        this.$store.state.alert.type = 'error'
        // increment component key to force component reload
        this.$store.state.baseRouterViewKey += 1
        console.log(err)
      })
    }
  },
  created () {
    this.getMissingFromHFR()
    this.loadingTree = true
    this.getTree(false, false, (err, tree) => {
      if (!err) {
        this.jurisdictionHierarchy = tree
      }
      this.loadingTree = false
    })
  },
  components: {
    'liquor-tree': LiquorTree
  }
}
</script>